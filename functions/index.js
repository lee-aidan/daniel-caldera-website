const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

exports.tmdbPosterLookup = onRequest(
    {cors: true},
    async (request, response) => {
      if (request.method !== "GET") {
        response.status(405).json({error: "method_not_allowed"});
        return;
      }

      const rawTitle = typeof request.query.title === "string" ?
        request.query.title : "";
      const title = rawTitle.trim();

      if (!title) {
        response.status(400).json({error: "missing_title"});
        return;
      }

      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) {
        response.status(500).json({error: "missing_tmdb_api_key"});
        return;
      }

      try {
        const url = new URL("https://api.themoviedb.org/3/search/multi");
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("query", title);

        const tmdbRes = await fetch(url);
        if (!tmdbRes.ok) {
          response.status(tmdbRes.status).json({error: "tmdb_request_failed"});
          return;
        }

        const json = await tmdbRes.json();
        const results = Array.isArray(json.results) ? json.results : [];
        const matchWithPoster = results.find((item) => item?.poster_path);

        if (!matchWithPoster?.poster_path) {
          response.set("Cache-Control", "public, max-age=300");
          response.json({posterUrl: null});
          return;
        }

        response.set("Cache-Control", "public, max-age=3600");
        response.json({
          posterUrl: `https://image.tmdb.org/t/p/w500${matchWithPoster.poster_path}`,
        });
      } catch (error) {
        console.error("tmdbPosterLookup failed", error);
        response.status(500).json({error: "internal_error"});
      }
    }
);
