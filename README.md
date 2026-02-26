# Big Dan’s Blog

Big Dan’s Blog is a full-stack web app for publishing and managing movie and television reviews. It includes a public-facing blog for readers and a secure admin interface that lets the site owner create, edit, pin, and delete content without touching the codebase.

This was the first website I ever built. I created it as a real product for my friend Daniel and as a hands-on learning project in end-to-end web development. Building it taught me how front-end interfaces connect to backend services, how authentication protects admin workflows, and how deployed applications are hosted and maintained on a live domain.

All HTML, CSS, JavaScript, and Firebase integration was self-taught and written by me.

---

## Project Highlights

- Public blog for browsing reviews
- Secure admin interface for content management
- Firebase Authentication for protected editing access
- Firestore for persistent content storage (reviews + about page)
- TMDB integration for automatic poster fetching
- Vanilla HTML/CSS/JavaScript (no front-end framework)

---

## HTML Architecture

The app uses a lightweight HTML “shell” approach: pages provide structure and predictable DOM targets, and JavaScript loads content dynamically at runtime.

### Example: tab-based UI + content targets (`index.html`)

```html
<nav>
  <button class="tab-button active" data-target="about">about</button>
  <button class="tab-button" data-target="reviews">reviews</button>
  <span class="nav-spacer"></span>
  <button class="tab-button" data-target="admin">admin</button>
</nav>

<section id="about" class="panel">
  <h2>about</h2>
  <div class="about-body">
    <p id="about-text"></p>
    <p id="about-status" class="about-status"></p>
  </div>
</section>

<section id="reviews" class="panel hidden">
  <h2>reviews</h2>
  <div id="posts"></div>
</section>
```

This keeps the markup simple while making the JavaScript logic easy to target and maintain.

---

## CSS Approach

Styling is managed in a single styles.css file using page-scoped selectors (data-page) so the public UI and admin UI can share one stylesheet without conflicting styles.

### CSS design goals

- Consistent spacing and typography across views
- Reusable UI patterns (pill buttons, tab navigation, section dividers)
- Fixed-width readable layout (`max-width: 720px`)
- Minimal, tool-like admin UI for usability
- 

### Example: page-scoped admin button styling (`styles.css`)


```css
[data-page="admin"] .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 8px 18px;
  border-radius: 999px;

  border: 1px solid #111111;
  background: #111111;
  color: #fafafa;

  font-size: 14px;
  font-weight: 500;
}
```

This approach helped me build a consistent design system without frameworks.

---

## Firebase Integration

Firebase powers the app’s authentication and data layer, allowing the site owner to manage content securely while keeping the public blog read-only.

### Authentication (Firebase Auth)

Firebase Authentication restricts admin functionality so only signed-in users can create, edit, or delete content.

### Example: auth state controls admin UI (`app.js`)

```js
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.classList.add("hidden");
    postSection.classList.remove("hidden");
    aboutSection.classList.remove("hidden");
    logoutButton.classList.remove("hidden");
    userInfo.textContent = `signed in as ${user.email}`;
  } else {
    loginSection.classList.remove("hidden");
    postSection.classList.add("hidden");
    aboutSection.classList.add("hidden");
    logoutButton.classList.add("hidden");
    userInfo.textContent = "";
  }
});
```

This keeps the admin workflow simple for a non-technical user while protecting write access.

---

## Firestore (Content Storage)

Firestore stores:

- Review posts (documents in a `posts` collection)

- About page content (document in a site/settings-style location)

Public pages read from Firestore and render content dynamically. Admin edits write directly to Firestore, so updates appear without redeploying the site.

### Example: fetching posts for the reviews tab (`app.js`)

```js
const postsQuery = query(
  collection(db, "posts"),
  orderBy("createdAt", "desc")
);

const snapshot = await getDocs(postsQuery);

if (snapshot.empty) {
  container.innerHTML = '<p class="empty-message">no reviews yet.</p>';
  return;
}
```

---

## Movie Poster Fetching (TMDB)

To improve the visual quality of reviews, the app automatically fetches movie/TV posters from The Movie Database (TMDB).

### How it works

- Admin enters a movie/show title while creating or editing a review
- The app looks up a matching poster
- The selected poster URL is saved with the post
- If no poster is found, the review still saves normally

Poster URLs are persisted with the review so posts keep the original artwork they were created with.

### Example: poster lookup call (`app.js`)

```js
const res = await fetch(
  `/api/tmdb-poster?title=${encodeURIComponent(title)}`
);

if (!res.ok) return null;

const json = await res.json();
return typeof json.posterUrl === "string" ? json.posterUrl : null;
```

### Example: Firebase Function proxy for TMDB (`index.js`)

```js
exports.tmdbPosterLookup = onRequest({ cors: true }, async (request, response) => {
  const title = (request.query.title || "").trim();
  const apiKey = process.env.TMDB_API_KEY;

  if (!title) {
    response.status(400).json({ error: "missing_title" });
    return;
  }

  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", title);

  const tmdbRes = await fetch(url);
  const json = await tmdbRes.json();
  const results = Array.isArray(json.results) ? json.results : [];
  const match = results.find((item) => item?.poster_path);

  response.json({
    posterUrl: match?.poster_path
      ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
      : null
  });
});
```

This let me practice API integration, server-side key handling, and graceful fallbacks.

---

## tl;dr

Big Dan’s Blog is a full-stack review platform built from scratch with vanilla HTML, CSS, JavaScript, and Firebase. It includes a public blog, a secure admin interface, Firestore-based content management, and TMDB poster integration. The project was built as a real product and as a first end-to-end web development project.




