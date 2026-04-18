import { useEffect, useRef, useState } from "react";



function wireShare(root) {

  if (!root) return;

  const pageUrl = root.dataset.shareUrl || window.location.href;

  const title = root.dataset.shareTitle || document.title;

  const text =

    root.dataset.shareText ||

    `${title} — Synthetic Data Generator (DataGen)`;



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

        .share({ title, text, url: pageUrl })

        .catch(() => {});

    });

  } else if (btnNative) {

    btnNative.style.display = "none";

  }



  if (btnCopy) {

    btnCopy.addEventListener("click", function () {

      const done = () => {

        btnCopy.classList.add("blog-share-copied");

        const old = btnCopy.textContent;

        btnCopy.textContent = "Copied!";

        setTimeout(() => {

          btnCopy.classList.remove("blog-share-copied");

          btnCopy.textContent = old;

        }, 2000);

      };

      if (navigator.clipboard?.writeText) {

        navigator.clipboard.writeText(pageUrl).then(done).catch(() => {

          window.prompt("Copy this URL:", pageUrl);

        });

      } else {

        window.prompt("Copy this URL:", pageUrl);

      }

    });

  }

}



/** Share + Utterances; render inside interactive <main> so width matches article column. */

export function BlogShareComments() {

  const shareRootRef = useRef(null);

  const utterancesHostRef = useRef(null);

  const shareWired = useRef(false);

  const utterancesLoaded = useRef(false);



  const [shareUrl] = useState(() =>

    typeof window !== "undefined" ? window.location.href : ""

  );

  const [shareTitle] = useState(() =>

    typeof document !== "undefined" ? document.title : ""

  );

  const [shareText] = useState(() => {

    if (typeof document === "undefined") return "";

    return (

      document.querySelector('meta[name="description"]')?.getAttribute("content") ||

      "Interactive DataGen series: programmable money, agents, MCP, contracts, and settlement."

    );

  });



  useEffect(() => {

    if (shareWired.current) return;

    shareWired.current = true;

    wireShare(shareRootRef.current);

  }, []);



  useEffect(() => {

    if (utterancesLoaded.current) return;

    const host = utterancesHostRef.current;

    if (!host) return;

    if (host.querySelector('script[src^="https://utteranc.es/client.js"]')) return;

    utterancesLoaded.current = true;

    const script = document.createElement("script");

    script.src = "https://utteranc.es/client.js";

    script.async = true;

    script.setAttribute("repo", "shazily/syntheticdatagen");

    script.setAttribute("issue-term", "pathname");

    script.setAttribute("theme", "github-dark");

    script.setAttribute("label", "blog");

    script.setAttribute("crossorigin", "anonymous");

    host.appendChild(script);

  }, []);



  return (

    <div className="mt-20 md:mt-24 pt-10 border-t border-slate-800/70">

      <div

        ref={shareRootRef}

        id="blog-share-root"

        className="blog-share blog-share--series"

        data-share-url={shareUrl}

        data-share-title={shareTitle}

        data-share-text={shareText}

      >

        <p className="blog-share-title">Share</p>

        <div className="blog-share-buttons">

          <a className="blog-share-linkedin" data-share="linkedin" href="#" rel="noopener noreferrer">

            LinkedIn

          </a>

          <a className="blog-share-x" data-share="x" href="#" rel="noopener noreferrer">

            X

          </a>

          <button type="button" className="blog-share-native" data-share="native" style={{ display: "none" }}>

            Share…

          </button>

          <button type="button" className="blog-share-copy" data-share="copy">

            Copy link

          </button>

        </div>

      </div>



      <section className="blog-comments blog-comments--series" aria-labelledby="comments-heading">

        <h2 id="comments-heading" className="blog-comments-title">

          Comments

        </h2>

        <p className="blog-comments-lead">

          Discussion is powered by{" "}

          <a href="https://utteranc.es/" target="_blank" rel="noopener noreferrer">

            Utterances

          </a>{" "}

          (GitHub sign-in).

        </p>

        <div ref={utterancesHostRef} />

      </section>

    </div>

  );

}



/** Site chrome; full-width below the interactive shell. */

export function BlogSiteFooter() {

  return (

    <footer className="footer">

      <div className="footer-content">

        <div className="footer-left">

          <p>&copy; 2025 Synthetic Data Generator. Free for general public use.</p>

        </div>

        <nav className="footer-links" aria-label="Site footer">

          <a

            href="https://www.linkedin.com/in/shazilymunawar/"

            className="linkedin-link linkedin-link--datagen"

            target="_blank"

            rel="noopener noreferrer"

            title="Shazily Munawar on LinkedIn"

          >

            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">

              <path

                fill="currentColor"

                d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"

              />

            </svg>

            LinkedIn

          </a>

          <span className="footer-sep" aria-hidden="true">

            ·

          </span>

          <a

            href="https://github.com/shazily/syntheticdatagen"

            target="_blank"

            rel="noopener noreferrer"

            className="footer-legal-link"

          >

            GitHub

          </a>

          <span className="footer-sep" aria-hidden="true">

            ·

          </span>

          <a href="/changelog.html" className="changelog-link">

            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">

              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z" />

              <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1H8V3.5z" />

            </svg>

            Changelog

          </a>

          <span className="footer-sep" aria-hidden="true">

            ·

          </span>

          <a href="/privacy.html" className="footer-legal-link">

            Privacy

          </a>

          <span className="footer-sep" aria-hidden="true">

            ·

          </span>

          <a href="/terms.html" className="footer-legal-link">

            Terms

          </a>

        </nav>

      </div>

    </footer>

  );

}



export function BlogFooter() {

  return (

    <>

      <BlogShareComments />

      <BlogSiteFooter />

    </>

  );

}

