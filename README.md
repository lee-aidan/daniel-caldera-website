# Big Dan’s Blog

Big Dan’s Blog is a full-stack web application built to publish and manage movie and television reviews. The site includes a public-facing blog for readers and a secure admin interface designed to give the site owner complete control over all content without requiring access to the source code. All content creation, editing, and removal is handled through a protected admin page designed for a non-technical user.

This project was the first website I've ever built. It serves as both a functional product for my friend Daniel and as a hands-on learning exercise in end-to-end web development and real-world application design. In the process, I learned how front-end code communicates with backend services as well as how deployed applications are hosted and connected to a live domain.

All HTML, CSS, JavaScript, and Firebase integration was self-taught and written entirely by me. 

---

## HTML Development

The site’s HTML is structured as a clean “shell” that JavaScript fills in at runtime. On the homepage (index.html), the app renders inside two main layers: a welcome overlay (#welcome-layer) and the main application container (#app-layer). The “enter” button reveals the app layer, and the page uses simple, predictable IDs (#about-text, #about-status, and #posts) as target anchors where app.js injects the bio text, status messages, and the list of review cards. Navigation is implemented using tab-style buttons (.tab-button with data-target="about" / data-target="reviews") so the UI can switch panels without navigating to new pages, while the dedicated admin.html route is linked separately for protected editing.

#### from `index.html`:

```html
<section id="welcome-layer" class="welcome-root">
  <div class="welcome-panel">
    <h1 class="welcome-title">big dan's blog</h1>
    <p class="welcome-subtitle">unfiltered takes on film &amp; tv</p>
    <button id="enterButton" class="button-primary">enter</button>
  </div>
</section>

<div id="app-layer" class="page-root hidden">
  <nav>
    <button class="tab-button active" data-target="about">about</button>
    <button class="tab-button" data-target="reviews">reviews</button>
    <span class="nav-spacer"></span>
    <a href="admin.html" class="tab-link">admin</a>
  </nav>

  <section id="about" class="panel">
    <p id="about-text"></p>
    <p id="about-status" class="about-status"></p>
  </section>

  <section id="reviews" class="panel hidden">
    <div id="posts"></div>
  </section>
</div>
```

---

## CSS Development

Styling is handled in a single stylesheet (styles.css) using a page-scoped approach based on the data-page attribute (for example: body[data-page="index"], body[data-page="admin"], and body[data-page="post"]). This keeps styles isolated so the admin UI can look intentionally “tool-like” and minimal, while the public pages stay clean and readable. Reusable UI patterns (pill buttons, tab navigation, spacing rhythm, typography rules, and card-like layout sections) are defined per page without relying on frameworks, and layout is kept consistent by centering content in a fixed-width column (max-width: 720px) across the main views. The index page emphasizes typography and lightweight navigation, while the admin page adds structured form styling, action rows, and list-row controls for editing and deleting posts.

#### from `styles.css` (page-scoped styling):

```css
body[data-page="admin"] .button {
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

---

## Firebase Integration

Firebase is used to support two core parts of the application: authentication and content persistence. Rather than acting as a generic backend, Firebase enables the site owner to securely manage content through the admin interface while keeping the public site read-only.

### Authentication

Firebase Authentication is used to restrict access to the admin interface. Only an authenticated user can create, edit, or delete content. The admin page checks authentication state on load and conditionally reveals editing controls once a valid session is established. This allows Daniel to manage the site without exposing the underlying source code or deployment setup.

Authentication logic lives in app.js and is initialized as soon as the admin page loads. If a user is not authenticated, the admin tools remain hidden, and the login form is shown instead.

#### from `app.js` (auth state handling):

```js
onAuthStateChanged(auth, (user) => {
  if (user) {
    adminUI.classList.remove("hidden");
    loginForm.classList.add("hidden");
  } else {
    adminUI.classList.add("hidden");
    loginForm.classList.remove("hidden");
  }
});
```
This approach cleanly separates who can write from who can read, without adding unnecessary complexity.

### Databases (Firestore)

Firebase Firestore is used to persist all site content, including blog posts and the "about" page bio. Posts are stored as documents in a collection, while the bio text is stored as a single document. This allows all public-facing content to be updated dynamically without redeploying the site.

On the public homepage, content is fetched from Firestore and injected into the DOM at runtime. On the admin page, edits are written back to Firestore and reflected immediately on the public site.

#### from `app.js` (fetching posts):

```js
const q = query(postsRef, orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  postsContainer.innerHTML = "";
  snapshot.forEach((doc) => {
    renderPost(doc.data(), doc.id);
  });
});
```

This real-time listener keeps the UI in sync with the database and avoids manual refresh logic.

---

## Movie Poster Fetching (TMDB)

To enhance each review visually without adding extra work for the site owner, the app automatically fetches movie or TV posters using The Movie Database (TMDB) API. When creating or editing a post, the admin enters the title of a movie or show. The application then queries TMDB, selects the most relevant result, and attaches the poster URL to the post before saving it.

The logic is written to tolerate small variations in titles and to fail gracefully if no poster is found. The fetching logic is designed to tolerate small variations in titles and to fail gracefully if no match is found. If the API does not return a valid result, the post still saves and renders correctly without a poster image. Once a poster is attached, its URL is persisted with the review data, ensuring that the visual remains stable over time. This prevents existing posts from changing unexpectedly if TMDB updates or releases new artwork, such as a new season poster, allowing each review to retain the poster that was originally selected.

#### from `app.js` (poster fetch logic):

```js
const response = await fetch(
  `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&api_key=${TMDB_KEY}`
);

const data = await response.json();
const posterPath = data.results?.[0]?.poster_path || null;
```

This feature was a natural way for me to apply my informatics background while learning JavaScript, translating structured user input into a reliable query against an external data source and integrating the result directly into the application workflow. It allowed me to practice working with external APIs in a way that emphasized robustness while keeping the admin experience simple and intuitive.

---

## tl;dr

Big Dan’s Blog is a full-stack web application for publishing movie and television reviews, featuring a public blog and a secure admin interface for content management. Built from scratch using vanilla HTML, CSS, JavaScript, and Firebase, the project emphasizes clean front-end architecture, authenticated editing workflows, persistent data storage, and external API integration for poster fetching. This project was developed as a real-world learning exercise in end-to-end web development and system design.


