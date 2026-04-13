/**
 * Blog share helpers: LinkedIn, X (Twitter), native share, copy link.
 * Expects #blog-share-root with data-share-url and data-share-title.
 */
(function () {
  const root = document.getElementById("blog-share-root");
  if (!root) return;

  const pageUrl = root.dataset.shareUrl || window.location.href;
  const title = root.dataset.shareTitle || document.title;
  const text =
    root.dataset.shareText ||
    title + " — Synthetic Data Generator (DataGen)";

  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(text);

  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const xIntent = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  const btnIn = root.querySelector('[data-share="linkedin"]');
  const btnX = root.querySelector('[data-share="x"]');
  const btnNative = root.querySelector('[data-share="native"]');
  const btnCopy = root.querySelector('[data-share="copy"]');

  if (btnIn) {
    btnIn.href = linkedIn;
    btnIn.target = "_blank";
    btnIn.rel = "noopener noreferrer";
  }
  if (btnX) {
    btnX.href = xIntent;
    btnX.target = "_blank";
    btnX.rel = "noopener noreferrer";
  }

  if (btnNative && navigator.share) {
    btnNative.style.display = "inline-flex";
    btnNative.addEventListener("click", function (e) {
      e.preventDefault();
      navigator
        .share({ title: title, text: text, url: pageUrl })
        .catch(function () {});
    });
  } else if (btnNative) {
    btnNative.style.display = "none";
  }

  if (btnCopy) {
    btnCopy.addEventListener("click", function () {
      const done = function () {
        btnCopy.classList.add("blog-share-copied");
        const old = btnCopy.textContent;
        btnCopy.textContent = "Copied!";
        setTimeout(function () {
          btnCopy.classList.remove("blog-share-copied");
          btnCopy.textContent = old;
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pageUrl).then(done).catch(function () {
          prompt("Copy this URL:", pageUrl);
        });
      } else {
        prompt("Copy this URL:", pageUrl);
      }
    });
  }
})();
