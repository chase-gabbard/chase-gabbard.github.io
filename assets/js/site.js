/* GabLab site scripts: mobile menu, research slideshow, image viewer. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        toggle.focus();
      }
    });
  }

  /* ---------- Footer year ---------- */
  $all('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Looping videos: hold still for people who prefer less motion ---------- */
  if (reduceMotion.matches) {
    $all('video[autoplay]').forEach(function (v) {
      v.removeAttribute('autoplay');
      v.pause();
      if (!v.hasAttribute('data-decorative')) v.setAttribute('controls', '');
    });
  }

  /* ---------- Home page bead video: only load it where it is shown (not on phones) ---------- */
  $all('video[data-src]').forEach(function (v) {
    function start() {
      if (reduceMotion.matches || v.getAttribute('src') || v.offsetParent === null) return;
      var webm = v.getAttribute('data-src-webm');
      var useWebm = webm && !v.canPlayType('video/mp4; codecs="avc1.640028"') && v.canPlayType('video/webm; codecs="vp9"');
      v.src = useWebm ? webm : v.getAttribute('data-src');
      var playing = v.play();
      if (playing && playing.catch) playing.catch(function () {});
    }
    start();
    window.addEventListener('resize', start);
  });

  /* ---------- Research slideshow ---------- */
  $all('[data-carousel]').forEach(function (root) {
    var slides = $all('.slide', root);
    if (slides.length < 2) return;

    var viewport = root.querySelector('.carousel__viewport');
    var counter = root.querySelector('[data-counter]');
    var playButton = root.querySelector('[data-play]');
    var thumbs = $all('[data-goto]', root);
    var interval = parseInt(root.getAttribute('data-interval'), 10) || 6500;

    var index = 0;
    var elapsed = 0;
    var last = 0;
    var raf = 0;
    var pausedByUser = reduceMotion.matches;
    var pausedByHover = false;
    var pausedByFocus = false;
    var offscreen = false;

    function isPlaying() {
      return !pausedByUser && !pausedByHover && !pausedByFocus && !offscreen && !document.hidden;
    }

    function setProgress(p) {
      var t = thumbs[index];
      if (t) t.style.setProperty('--progress', p.toFixed(4));
    }

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (slide, k) {
        var active = k === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        if ('inert' in slide) slide.inert = !active;
      });
      thumbs.forEach(function (t, k) {
        t.setAttribute('aria-current', k === index ? 'true' : 'false');
        t.style.setProperty('--progress', '0');
      });
      if (counter) counter.textContent = (index + 1) + ' / ' + slides.length;
      elapsed = 0;
      setProgress(0);
    }

    function tick(now) {
      if (last) elapsed += now - last;
      last = now;
      if (elapsed >= interval) show(index + 1);
      setProgress(Math.min(elapsed / interval, 1));
      raf = window.requestAnimationFrame(tick);
    }

    function update() {
      var playing = isPlaying();
      root.classList.toggle('is-paused', pausedByUser);
      viewport.setAttribute('aria-live', playing ? 'off' : 'polite');
      if (playButton) {
        playButton.setAttribute('aria-label', pausedByUser ? 'Play slideshow' : 'Pause slideshow');
      }
      if (playing && !raf) {
        last = 0;
        raf = window.requestAnimationFrame(tick);
      } else if (!playing && raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function go(i) {
      show(i);
      update();
    }

    root.querySelector('[data-prev]').addEventListener('click', function () { go(index - 1); });
    root.querySelector('[data-next]').addEventListener('click', function () { go(index + 1); });
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { go(parseInt(t.getAttribute('data-goto'), 10)); });
    });
    if (playButton) {
      playButton.addEventListener('click', function () {
        pausedByUser = !pausedByUser;
        update();
      });
    }

    root.addEventListener('mouseenter', function () { pausedByHover = true; update(); });
    root.addEventListener('mouseleave', function () { pausedByHover = false; update(); });
    root.addEventListener('focusin', function () { pausedByFocus = true; update(); });
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) { pausedByFocus = false; update(); }
    });
    document.addEventListener('visibilitychange', update);

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    /* swipe on touch screens */
    var startX = null;
    var startY = null;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      startX = e.clientX;
      startY = e.clientY;
    });
    viewport.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
    });
    viewport.addEventListener('pointercancel', function () { startX = null; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        offscreen = !entries[0].isIntersecting;
        update();
      }, { threshold: 0.25 }).observe(root);
    }

    show(0);
    update();
  });

  /* ---------- Research themes: hovering a theme opens its panel, which grows out from under the name ---------- */
  $all('[data-themes]').forEach(function (root) {
    var tabs = $all('[role="tab"]', root);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var stage = root.querySelector('.theme-stage');
    var wide = window.matchMedia('(min-width: 900px)');
    var current = 0;
    var z = 2;
    var hoverTimer = 0;
    var cleanupTimer = 0;

    function cleanup() {
      panels.forEach(function (p) {
        p.classList.remove('is-leaving');
        p.style.transition = '';
        p.style.clipPath = '';
        p.style.zIndex = '';
      });
      z = 2;
    }

    function activate(i) {
      if (i === current) return;
      var prev = panels[current];
      var next = panels[i];
      current = i;
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', k === i ? 'true' : 'false');
        t.tabIndex = k === i ? 0 : -1;
      });

      // Hold the previous panel where it is while the new one opens over it.
      prev.style.transition = 'opacity 0.35s ease';
      prev.style.clipPath = window.getComputedStyle(prev).clipPath;
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');

      next.classList.remove('is-leaving');
      next.style.zIndex = String(++z);
      if (wide.matches && !reduceMotion.matches) {
        var s = stage.getBoundingClientRect();
        var t = tabs[i].getBoundingClientRect();
        var left = Math.max(0, t.left - s.left);
        var right = Math.max(0, s.right - t.right);
        next.style.transition = 'none';
        next.style.clipPath = 'inset(0 ' + right + 'px 0 ' + left + 'px)';
        next.classList.add('is-active');
        void next.offsetWidth; // start from the column under the name
        next.style.transition = '';
        next.style.clipPath = 'inset(0 0 0 0)';
      } else {
        next.style.clipPath = '';
        next.classList.add('is-active');
      }
      clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(cleanup, 650);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('mouseenter', function () {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { activate(i); }, 70);
      });
      tab.addEventListener('mouseleave', function () { clearTimeout(hoverTimer); });
      tab.addEventListener('click', function () { clearTimeout(hoverTimer); activate(i); });
      tab.addEventListener('focus', function () { activate(i); });
      tab.addEventListener('keydown', function (e) {
        var k = null;
        if (e.key === 'ArrowRight') k = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') k = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') k = 0;
        if (e.key === 'End') k = tabs.length - 1;
        if (k !== null) {
          e.preventDefault();
          tabs[k].focus();
        }
      });
    });
    if (wide.addEventListener) wide.addEventListener('change', cleanup);
  });

  /* ---------- Prospective students: section bar ----------
     Appears once the page title scrolls under it and underlines the section being read. */
  $all('[data-local-nav]').forEach(function (bar) {
    var list = bar.querySelector('.local-nav__links');
    var links = $all('a', list);
    var sections = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var trigger = document.querySelector('[data-local-nav-trigger]');
    var current = -2;
    var queued = false;

    function update() {
      queued = false;
      var height = bar.offsetHeight;
      bar.classList.toggle('is-visible', !trigger || trigger.getBoundingClientRect().bottom < height);

      var line = height + 40;
      var index = -1;
      sections.forEach(function (section, i) {
        if (section && section.getBoundingClientRect().top <= line) index = i;
      });
      var doc = document.documentElement;
      if (index >= 0 && window.innerHeight + window.pageYOffset >= doc.scrollHeight - 2) index = sections.length - 1;

      if (index === current) return;
      current = index;
      links.forEach(function (a, i) {
        if (i === index) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      if (index >= 0 && list.scrollWidth > list.clientWidth) {
        list.scrollLeft = links[index].parentNode.offsetLeft - 16;
      }
    }

    function queue() {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  });

  /* ---------- Tabs (graduate application info) ---------- */
  $all('[data-tabs]').forEach(function (root) {
    var tabs = $all('[role="tab"]', root);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });

    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('is-active', on);
        panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var k = null;
        if (e.key === 'ArrowRight') k = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') k = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') k = 0;
        if (e.key === 'End') k = tabs.length - 1;
        if (k !== null) {
          e.preventDefault();
          select(k, true);
        }
      });
    });

    var start = 0;
    tabs.forEach(function (t, k) { if (t.getAttribute('aria-selected') === 'true') start = k; });
    select(start, false);
  });

  /* ---------- Image viewer ---------- */
  var viewerLinks = $all('a[data-lightbox]');
  if (viewerLinks.length && typeof window.HTMLDialogElement === 'function') {
    var dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Image viewer');
    dialog.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Close image viewer">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '<figure class="lightbox__figure"><img alt="">' +
      '<figcaption class="lightbox__caption"><span class="lightbox__text"></span>' +
      '<a class="lightbox__full" target="_blank" rel="noopener">Open full-size image</a></figcaption></figure>';
    document.body.appendChild(dialog);

    var viewerImg = dialog.querySelector('img');
    var viewerText = dialog.querySelector('.lightbox__text');
    var viewerFull = dialog.querySelector('.lightbox__full');

    viewerLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        var thumb = link.querySelector('img');
        viewerImg.src = link.getAttribute('href');
        viewerImg.alt = thumb ? thumb.alt : '';
        viewerText.textContent = link.getAttribute('data-caption') || '';
        var full = link.getAttribute('data-full');
        viewerFull.hidden = !full;
        if (full) viewerFull.href = full;
        dialog.showModal();
      });
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || e.target.closest('.lightbox__close') ||
          e.target.classList.contains('lightbox__figure')) {
        dialog.close();
      }
    });
    dialog.addEventListener('close', function () { viewerImg.removeAttribute('src'); });
  }
})();
