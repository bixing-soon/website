from urllib.parse import unquote, urlparse

from js import Object, Response as JsResponse, caches # import js to interact with CF js APIs
from pyodide.ffi import to_js

from workers import Response, WorkerEntrypoint

PREFIX = "/images/"
CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"  # 1 day fresh, serve stale for a week


def js_object(values):
    return to_js(values, dict_converter=Object.fromEntries)

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url = request.url
        path = urlparse(url).path

        # anything that is not an image goes to the static assets binding
        if not path.startswith(PREFIX):
            assets = getattr(self.env, "assets-bind")
            return await assets.fetch(request)

        # images are read-only, so only GET and HEAD make sense
        if request.method not in ("GET", "HEAD"):
            return Response(
                "Method Not Allowed",
                status=405,
                headers={"Allow": "GET, HEAD"},
            )

        is_head = request.method == "HEAD"
        cache = caches.default

        # looks up edge cache, with plain URL string used as key
        # this is treated by the cache api as GET, cuz stored response has etag and Conteng-Length
        # cache.match() also answers If-None-Match (304) and Range (206) on its own
        cached = await cache.match(url)
        if cached is not None:
            if not is_head:
                return cached
            # A HEAD reply must not carry a body.
            return JsResponse.new(
                None,
                js_object({"status": cached.status, "headers": cached.headers}),
            )

        # if cache miss, read the object from R2, consumes Class B (GetObject) ops
        key = unquote(path[len(PREFIX):])
        bucket = getattr(self.env, "bucket-bind")

        # Build an explicit R2Range from the client's Range header. Handing R2
        # the Headers object itself as `range` was misread by the binding (it
        # returned length ~= header count), truncating the image.
        range_header = request.headers.get("range")
        range_opt = None
        if range_header and range_header.startswith("bytes="):
            start_s, _, end_s = range_header[len("bytes="):].partition("-")
            if start_s.isdigit() and end_s.isdigit() and int(end_s) >= int(start_s):
                start = int(start_s)
                range_opt = js_object({"offset": start, "length": int(end_s) - start + 1})

        try:
            if range_opt is not None:
                obj = await bucket.get(key, onlyIf=request.headers, range=range_opt)
            else:
                obj = await bucket.get(key, onlyIf=request.headers)
        except Exception:
            return Response("Storage error", status=500)

        if obj is None:
            return Response("Image not found", status=404)

        # build response headers from metadata R2 returned with the object so no extra R2 call
        headers = {
            "etag": obj.httpEtag,
            "cache-control": CACHE_CONTROL,
            "accept-ranges": "bytes",
        }
        metadata = getattr(obj, "httpMetadata", None)
        content_type = getattr(metadata, "contentType", None) if metadata is not None else None
        if content_type:
            headers["content-type"] = content_type

        # if bodiless object then a precondition failed inside R2.
        if not hasattr(obj, "body"):
            status = 304 if request.headers.has("if-none-match") else 412
            return Response(None, status=status, headers=headers)

        # R2 hands back a `range` even for a full read, so only treat the reply
        # as a real partial when we actually asked R2 for one.
        rng = getattr(obj, "range", None)
        offset = getattr(rng, "offset", None) if rng is not None else None
        length = getattr(rng, "length", None) if rng is not None else None
        ranged = range_opt is not None and offset is not None and length is not None

        if ranged:
            headers["content-range"] = f"bytes {offset}-{offset + length - 1}/{obj.size}"
            headers["content-length"] = str(length)
        else:
            headers["content-length"] = str(obj.size)

        status = 206 if ranged else 200

        if is_head:
            return JsResponse.new(
                None,
                js_object({"status": status, "headers": headers}),
            )

        # stream obj body straight to client
        response = JsResponse.new(
            obj.body,
            js_object({"status": status, "headers": headers}),
        )

        # store complete response, only full GET are cached (206 not cacheable)
        # clone gives cache its own copy of body stream, so client gets the original
        if not ranged:
            try:
                await cache.put(url, response.clone())
            except Exception:
                pass

        return response
