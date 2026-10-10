# Cloudflare R2 browser upload CORS

This app uploads files directly from the browser to a short-lived R2 presigned URL. The R2 bucket must allow the browser origin or the browser reports only `Failed to fetch` for the upload request.

In Cloudflare, open **R2 > your bucket > Settings > CORS Policy**, add a policy, and replace `https://your-app.example.com` with the exact deployed app origin. Keep the local origin while developing:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-app.example.com"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Origins must match the browser address exactly, including `http`/`https` and any port, with no path. Add any other app or preview origins that need uploads. The upload is a browser `PUT` with a `Content-Type` header; document reads use `GET`. Cloudflare notes that CORS policy changes can take up to 30 seconds to propagate. See [Cloudflare's R2 CORS guide](https://developers.cloudflare.com/r2/buckets/cors/).
