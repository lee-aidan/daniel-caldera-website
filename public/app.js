import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

/* --------------------
   firebase (shared)
-------------------- */

// firebase client config (public)
const firebaseConfig = {
  apiKey: "AIzaSyCPiBcLcT-D22NU_wog3tMsPx8Mt-Mugkw",
  authDomain: "bigdansblog.firebaseapp.com",
  projectId: "bigdansblog",
  storageBucket: "bigdansblog.firebasestorage.app",
  messagingSenderId: "658236910222",
  appId: "1:658236910222:web:e131075a61c935555077df",
  measurementId: "G-TMPB4D815P"
};

// init once and reuse across pages
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ============================================================
   admin page
   ============================================================ */

function runAdminPage() {
  const TMDB_API_KEY = "99d2b566ed84053f039ef7bb723492fb";

  // look up a poster image for a given title 
  async function fetchPosterUrlForTitle(title) {
    if (!title || !TMDB_API_KEY) return null;

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      title
    )}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("tmdb error:", res.status, res.statusText);
        return null;
      }

      const json = await res.json();
      if (!json.results || !json.results.length) return null;

      // prefer a result with an actual poster
      const firstWithPoster =
        json.results.find((r) => r.poster_path) || json.results[0];

      if (!firstWithPoster.poster_path) return null;
      return `https://image.tmdb.org/t/p/w500${firstWithPoster.poster_path}`;
    } catch (err) {
      console.error("error fetching tmdb poster:", err);
      return null;
    }
  }

  // grab ui elements
  const loginSection = document.getElementById("login-section");
  const postSection = document.getElementById("post-section");
  const aboutSection = document.getElementById("about-section");

  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");

  const postForm = document.getElementById("post-form");
  const postMessage = document.getElementById("post-message");
  const userInfo = document.getElementById("user-info");
  const logoutButton = document.getElementById("logout-button");
  const postList = document.getElementById("post-list");
  const postSubmitButton = document.getElementById("post-submit-button");
  const cancelEditButton = document.getElementById("cancel-edit-button");

  const aboutForm = document.getElementById("about-form");
  const aboutContent = document.getElementById("about-content");
  const aboutMessage = document.getElementById("about-message");

  const mediaTitleInput = document.getElementById("post-media-title");

  // edit state
  let editingId = null;
  let editingOriginalMediaTitle = "";
  let editingOriginalPosterUrl = null;

  // toggle between "new post" mode and "edit post" mode
  function setEditingMode(postId = null, data = null) {
    editingId = postId;

    if (postId && data) {
      // fill form with the post being edited
      document.getElementById("post-title").value = data.title || "";
      document.getElementById("post-content").value = data.content || "";
      mediaTitleInput.value = data.mediaTitle || "";

      // keep original values so we know if we should refetch poster
      editingOriginalMediaTitle = data.mediaTitle || "";
      editingOriginalPosterUrl = data.posterUrl || null;

      postSubmitButton.textContent = "save changes";
      cancelEditButton.classList.remove("hidden");

      postMessage.textContent = "";
      postMessage.className = "";

      // bring form into view
      postSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // reset back to create mode
    editingId = null;
    editingOriginalMediaTitle = "";
    editingOriginalPosterUrl = null;

    postForm.reset();
    mediaTitleInput.value = "";

    postSubmitButton.textContent = "publish review";
    cancelEditButton.classList.add("hidden");

    postMessage.textContent = "";
    postMessage.className = "";
  }

  // timestamp -> local date string (no time)
  function formatDateOnly(ts) {
    try {
      return ts.toDate().toLocaleDateString();
    } catch {
      return "";
    }
  }

  // load + render all posts for admin list (pinned first)
  async function loadAdminPosts() {
    postList.innerHTML = "<p class='logged-in-note'>loading reviews…</p>";

    try {
      const postsQuery = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(postsQuery);

      if (snapshot.empty) {
        postList.innerHTML = "<p class='logged-in-note'>no reviews yet.</p>";
        return;
      }

      // normalize into an array so we can filter/sort + look up by id
      const all = [];
      snapshot.forEach((docSnap) => {
        all.push({ id: docSnap.id, data: docSnap.data() });
      });

      // pinned first, then unpinned
      const pinned = all.filter((p) => p.data.pinned === true);
      const unpinned = all.filter((p) => !p.data.pinned);

      // build list html for a set of posts
      const renderList = (items) =>
        items
          .map(({ id, data }) => {
            const dateStr =
              data.createdAt && typeof data.createdAt.toDate === "function"
                ? formatDateOnly(data.createdAt)
                : "";

            const pinnedBadge = data.pinned
              ? `<span class="pinned-badge">pinned</span>`
              : "";

            return `
              <div class="post-row" data-id="${id}">
                <div class="post-row-main">
                  <p class="post-row-title">${data.title || "untitled"}${pinnedBadge}</p>
                  ${dateStr ? `<p class="post-row-meta">${dateStr}</p>` : ""}
                </div>
                <div class="post-row-actions">
                  <button class="small-button" data-action="edit">edit</button>
                  <button class="small-button" data-action="pin">
                    ${data.pinned ? "unpin" : "pin"}
                  </button>
                  <button class="delete-button" data-action="delete">delete</button>
                </div>
              </div>
            `;
          })
          .join("");

      postList.innerHTML = renderList(pinned) + renderList(unpinned);

      // attach row action handlers (edit/pin/delete)
      postList.querySelectorAll(".post-row").forEach((row) => {
        const id = row.getAttribute("data-id");

        row.querySelectorAll("button").forEach((btn) => {
          const action = btn.getAttribute("data-action");

          // edit: fill form + switch to edit mode
          if (action === "edit") {
            btn.addEventListener("click", () => {
              const found = all.find((p) => p.id === id);
              if (found) setEditingMode(id, found.data);
            });
          }

          // pin: toggle pinned boolean
          if (action === "pin") {
            btn.addEventListener("click", async () => {
              const found = all.find((p) => p.id === id);
              if (!found) return;

              try {
                await updateDoc(doc(db, "posts", id), {
                  pinned: !found.data.pinned
                });
                await loadAdminPosts();
              } catch (err) {
                console.error(err);
                alert("could not update pin state.");
              }
            });
          }

          // delete: confirm then delete document
          if (action === "delete") {
            btn.addEventListener("click", async () => {
              const confirmed = window.confirm("delete this review?");
              if (!confirmed) return;

              try {
                await deleteDoc(doc(db, "posts", id));

                // if we were editing this post, exit edit mode
                if (editingId === id) setEditingMode(null);

                await loadAdminPosts();
              } catch (err) {
                console.error(err);
                alert("could not delete review.");
              }
            });
          }
        });
      });
    } catch (err) {
      console.error(err);
      postList.innerHTML = "<p class='logged-in-note'>couldn’t load reviews.</p>";
    }
  }

  // load about content into textarea
  async function loadAboutPage() {
    try {
      const ref = doc(db, "site", "about");
      const snap = await getDoc(ref);
      aboutContent.value = snap.exists() ? snap.data().content || "" : "";
    } catch (err) {
      console.error(err);
      aboutMessage.textContent = "couldn’t load about page.";
      aboutMessage.className = "error";
    }
  }

  // show/hide sections based on auth state
  function setLoginState(user, scrollToPost = false) {
    if (user) {
      // show admin ui
      loginSection.classList.add("hidden");
      postSection.classList.remove("hidden");
      aboutSection.classList.remove("hidden");
      logoutButton.classList.remove("hidden");

      userInfo.textContent = `signed in as ${user.email}`;

      loadAdminPosts();
      loadAboutPage();

      // when logging in, jump straight to the editor
      if (scrollToPost) {
        postSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      // logged out: only show login
      loginSection.classList.remove("hidden");
      postSection.classList.add("hidden");
      aboutSection.classList.add("hidden");
      logoutButton.classList.add("hidden");

      userInfo.textContent = "";
      setEditingMode(null);
    }

    // clear messages whenever state changes
    loginMessage.textContent = "";
    loginMessage.className = "";
    postMessage.textContent = "";
    postMessage.className = "";
    aboutMessage.textContent = "";
    aboutMessage.className = "";
  }

  // watch auth state (auto updates ui)
  onAuthStateChanged(auth, (user) => {
    setLoginState(user, false);
  });

  // login form
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    loginMessage.textContent = "";
    loginMessage.className = "";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setLoginState(cred.user, true);
    } catch (err) {
      console.error(err);
      loginMessage.textContent =
        "could not sign in. check your email and password.";
      loginMessage.className = "error";
    }
  });

  // create/edit review
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    postMessage.textContent = "";
    postMessage.className = "";

    const title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const mediaTitle = mediaTitleInput.value.trim();

    if (!title || !content) {
      postMessage.textContent = "please fill in both title and content.";
      postMessage.className = "error";
      return;
    }

    try {
      // editing an existing post
      if (editingId) {
        const updateData = { title, content, mediaTitle: mediaTitle || "" };

        // only refetch poster if the media title changed (or was missing before)
        const shouldRefetchPoster =
          (mediaTitle && mediaTitle !== editingOriginalMediaTitle) ||
          (!editingOriginalPosterUrl && mediaTitle);

        if (shouldRefetchPoster) {
          const searchTitle = mediaTitle || title;
          const newPosterUrl = await fetchPosterUrlForTitle(searchTitle);
          if (newPosterUrl) updateData.posterUrl = newPosterUrl;
        }

        await updateDoc(doc(db, "posts", editingId), updateData);

        postMessage.textContent = "review updated.";
        postMessage.className = "success";
      } else {
        // creating a new post
        const searchTitle = mediaTitle || title;
        const posterUrl = searchTitle
          ? await fetchPosterUrlForTitle(searchTitle)
          : null;

        await addDoc(collection(db, "posts"), {
          title,
          content,
          mediaTitle: mediaTitle || "",
          createdAt: serverTimestamp(),
          pinned: false,
          posterUrl: posterUrl || null
        });

        postMessage.textContent = "review published.";
        postMessage.className = "success";
      }

      // reset form + refresh list
      setEditingMode(null);
      await loadAdminPosts();
    } catch (err) {
      console.error(err);
      postMessage.textContent = "could not publish review.";
      postMessage.className = "error";
    }
  });

  // exit edit mode without saving
  cancelEditButton.addEventListener("click", () => {
    setEditingMode(null);
  });

  // save about page
  aboutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    aboutMessage.textContent = "";
    aboutMessage.className = "";

    if (!auth.currentUser) {
      aboutMessage.textContent = "please sign in to edit the about page.";
      aboutMessage.className = "error";
      return;
    }

    const content = aboutContent.value.trim();
    if (!content) {
      aboutMessage.textContent = "about text cannot be empty.";
      aboutMessage.className = "error";
      return;
    }

    try {
      await setDoc(doc(db, "site", "about"), { content });
      aboutMessage.textContent = "about page updated.";
      aboutMessage.className = "success";
    } catch (err) {
      console.error(err);
      aboutMessage.textContent = "could not update about page.";
      aboutMessage.className = "error";
    }
  });

  // sign out
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  });
}

/* ============================================================
   index page
   ============================================================ */

function runIndexPage() {
  // about is loaded once per visit (then cached)
  let aboutLoaded = false;

  async function loadAbout() {
    if (aboutLoaded) return;

    const aboutEl = document.getElementById("about-text");
    const statusEl = document.getElementById("about-status");
    if (!aboutEl) return;

    statusEl.textContent = "loading about…";

    try {
      const snap = await getDoc(doc(db, "site", "about"));
      if (snap.exists()) {
        const data = snap.data();

        if (data && typeof data.content === "string" && data.content.trim()) {
          aboutEl.textContent = data.content;
          statusEl.textContent = "";
        } else {
          aboutEl.textContent = "";
          statusEl.textContent = "about page is empty.";
        }
      } else {
        aboutEl.textContent = "";
        statusEl.textContent = "about page not found.";
      }
    } catch (err) {
      console.error("error loading about page:", err);
      aboutEl.textContent = "";
      statusEl.textContent = "couldn’t load about page.";
    } finally {
      aboutLoaded = true;
    }
  }

  // fetch posts from firestore and render them
  async function loadPosts() {
    const container = document.getElementById("posts");
    container.innerHTML = '<p class="empty-message">loading…</p>';

    try {
      const postsQuery = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(postsQuery);

      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-message">no reviews yet.</p>';
        return;
      }

      // keep a local array so we can split pinned/unpinned
      const all = [];
      snapshot.forEach((docSnap) => {
        all.push({ id: docSnap.id, data: docSnap.data() });
      });

      const pinned = all.filter((p) => p.data.pinned === true);
      const unpinned = all.filter((p) => !p.data.pinned);

      function formatDateOnly(ts) {
        try {
          return ts.toDate().toLocaleDateString();
        } catch {
          return "";
        }
      }

      // card html for a single post
      const renderCard = ({ id, data }) => {
        const dateStr =
          data.createdAt && typeof data.createdAt.toDate === "function"
            ? formatDateOnly(data.createdAt)
            : "";

        const pinnedBadge = data.pinned ? " · pinned" : "";

        return `
          <article class="post-card">
            <h3 class="post-title">
              <a href="post.html?id=${encodeURIComponent(id)}" class="post-link">
                ${data.title || "untitled"}
              </a>
            </h3>
            ${dateStr ? `<p class="post-meta">${dateStr}${pinnedBadge}</p>` : ""}
          </article>
        `;
      };

      container.innerHTML =
        pinned.map(renderCard).join("") + unpinned.map(renderCard).join("");
    } catch (err) {
      console.error("error loading posts:", err);
      container.innerHTML =
        '<p class="empty-message">couldn’t load reviews. try again later.</p>';
    }
  }

  // grab ui elements
  const welcomeLayer = document.getElementById("welcome-layer");
  const appLayer = document.getElementById("app-layer");
  const enterButton = document.getElementById("enterButton");

  const tabButtons = document.querySelectorAll(".tab-button");
  const aboutSection = document.getElementById("about");
  const reviewsSection = document.getElementById("reviews");

  // switch panels and trigger data loads
  function setActiveTab(tabName) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === tabName);
    });

    if (tabName === "about") {
      aboutSection.classList.remove("hidden");
      reviewsSection.classList.add("hidden");
      loadAbout();
      return;
    }

    aboutSection.classList.add("hidden");
    reviewsSection.classList.remove("hidden");
    loadPosts();
  }

  // hide welcome overlay and show app
  function showAppLayer(defaultTab = "about") {
    welcomeLayer.classList.add("hidden");
    appLayer.classList.remove("hidden");
    setActiveTab(defaultTab);
  }

  // initial view based on url hash
  if (window.location.hash === "#reviews") {
    showAppLayer("reviews");
  } else {
    welcomeLayer.classList.remove("hidden");
    appLayer.classList.add("hidden");
  }

  // enter -> show app + about
  enterButton.addEventListener("click", () => {
    showAppLayer("about");
  });

  // tab clicks
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.target);
    });
  });
}

/* ============================================================
   post page
   ============================================================ */

function runPostPage() {
  const mainEl = document.getElementById("content");

  // post id is passed as ?id=...
  function getPostIdFromUrl() {
    return new URLSearchParams(window.location.search).get("id");
  }

  async function loadPost() {
    const postId = getPostIdFromUrl();

    if (!postId) {
      mainEl.innerHTML = '<p class="message">No post id provided.</p>';
      return;
    }

    try {
      const ref = doc(db, "posts", postId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        mainEl.innerHTML =
          '<p class="message">That post could not be found.</p>';
        return;
      }

      const data = snap.data();

      // date string (no time)
      const dateStr =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toLocaleDateString()
          : "";

      // optional poster
      const posterHtml = data.posterUrl
        ? `<div class="post-poster-wrapper">
             <img
               class="post-poster"
               src="${data.posterUrl}"
               alt="${data.mediaTitle || data.title || "poster"}"
             />
           </div>`
        : "";

      // render post
      mainEl.innerHTML = `
        <article>
          <h2 class="post-title">${data.title || "Untitled"}</h2>
          ${dateStr ? `<p class="post-meta">${dateStr}</p>` : ""}
          ${posterHtml}
          <p class="post-body">${data.content || ""}</p>
        </article>
      `;
    } catch (err) {
      console.error(err);
      mainEl.innerHTML = '<p class="message">Couldn’t load this post.</p>';
    }
  }

  loadPost();
}

/* ============================================================
   router
   ============================================================ */

// run the correct page script based on body[data-page]
const page = document.body?.dataset?.page || "";

if (page === "admin") runAdminPage();
if (page === "index") runIndexPage();
if (page === "post") runPostPage();