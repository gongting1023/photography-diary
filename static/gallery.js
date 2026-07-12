/* ============================================
   3D Gallery - Exhibition Mode
   ============================================ */

(function() {
  'use strict';

  var active = false;
  var albums = [];
  var current = 0;
  var track, panels = [];
  var isDragging = false, startX = 0, startIdx = 0;
  var loadedCount = 0;

  function init() {
    var ov = document.createElement('div');
    ov.className = 'gallery-overlay';
    ov.innerHTML =
      '<div class="gallery-vignette"></div>' +
      '<div class="gallery-track" id="gTr"></div>' +
      '<button class="gallery-nav prev" id="gPr">‹</button>' +
      '<button class="gallery-nav next" id="gNx">›</button>' +
      '<div class="gallery-title" id="gTi"></div>' +
      '<div class="gallery-counter" id="gCo"></div>' +
      '<div class="gallery-hint">点击照片进入相册</div>' +
      '<button class="gallery-exit" id="gEx">✕</button>' +
      '<div class="gallery-loading" id="gLd"><div class="spinner"></div>正在布展...</div>';
    document.body.appendChild(ov);

    track = document.getElementById('gTr');

    document.getElementById('gEx').addEventListener('click', exit);
    document.getElementById('gPr').addEventListener('click', function() { go(current - 1); });
    document.getElementById('gNx').addEventListener('click', function() { go(current + 1); });
    document.addEventListener('keydown', kd);

    ov.addEventListener('mousedown', md);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    ov.addEventListener('touchstart', ts, { passive: true });
    document.addEventListener('touchmove', tm, { passive: true });
    document.addEventListener('touchend', te);
  }

  function kd(e) {
    if (!active) return;
    if (e.key === 'Escape') { exit(); return; }
    if (e.key === 'ArrowLeft') { go(current - 1); return; }
    if (e.key === 'ArrowRight') { go(current + 1); return; }
  }

  function md(e) {
    if (!active || e.target.closest('.gallery-nav') || e.target.closest('.gallery-exit')) return;
    isDragging = true; startX = e.clientX; startIdx = current;
    track.style.transition = 'none';
  }
  function mm(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX;
    var vw = window.innerWidth;
    var offset = -startIdx * vw + dx;
    track.style.transform = 'translateX(' + offset + 'px)';
  }
  function mu(e) {
    if (!isDragging) return;
    isDragging = false;
    track.style.transition = '';
    var dx = e.clientX - startX;
    if (dx < -80) go(startIdx + 1);
    else if (dx > 80) go(startIdx - 1);
    else go(startIdx);
  }

  var tsx = 0, tsIdx = 0;
  function ts(e) {
    if (!active || e.touches.length !== 1) return;
    tsx = e.touches[0].clientX; tsIdx = current;
    track.style.transition = 'none';
  }
  function tm(e) {
    if (!active || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - tsx;
    var vw = window.innerWidth;
    track.style.transform = 'translateX(' + (-tsIdx * vw + dx) + 'px)';
  }
  function te(e) {
    track.style.transition = '';
    if (!active) return;
    var dx = (e.changedTouches ? e.changedTouches[0].clientX : 0) - tsx;
    if (dx < -60) go(tsIdx + 1);
    else if (dx > 60) go(tsIdx - 1);
    else go(tsIdx);
  }

  function go(idx) {
    if (!active) return;
    if (idx < 0) idx = albums.length - 1;
    if (idx >= albums.length) idx = 0;
    current = idx;
    var tx = -idx * window.innerWidth;
    track.style.transform = 'translateX(' + tx + 'px)';
    updateMeta();
  }

  function updateMeta() {
    var a = albums[current];
    document.getElementById('gTi').textContent = a.display_name || a.url || '';
    document.getElementById('gCo').textContent = (current + 1) + ' / ' + albums.length;
  }

  function enter() {
    if (active) return;
    active = true;
    document.getElementById('gLd').style.display = 'block';
    document.querySelector('.gallery-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    var c = sessionStorage.getItem('albums_data');
    if (c) {
      try {
        var d = JSON.parse(c);
        if (d.albums && d.albums.length > 0) {
          albums = d.albums.slice().sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
          build();
          return;
        }
      } catch(e) {}
    }

    var base = window.location.hostname === 'localhost' ? 'http://localhost:1023' : '';
    fetch(base + '/.netlify/functions/albums')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.albums && d.albums.length > 0) {
          albums = d.albums.slice().sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
          build();
        }
      })
      .catch(function() { document.getElementById('gLd').innerHTML = '加载失败'; });
  }

  function exit() {
    if (!active) return;
    active = false;
    document.querySelector('.gallery-overlay').classList.remove('active');
    document.body.style.overflow = '';
    track.innerHTML = '';
    panels = [];
    current = 0;
  }

  function getPhotos(a) {
    var p = [];
    if (a.images && a.images.length) {
      p = a.images.filter(function(i) { return i && i.url && i.url !== 'undefined' && i.url.startsWith('http'); });
    }
    if (p.length === 0 && a.coverImage && a.coverImage !== 'undefined' && a.coverImage.startsWith('http')) {
      p = [{ url: a.coverImage }];
    }
    return p;
  }

  function calcGrid(n) {
    var cols, fw, fh;
    if (n <= 2)  { cols = 2; fw = 280; fh = 200; }
    else if (n <= 4)  { cols = 2; fw = 260; fh = 185; }
    else if (n <= 6)  { cols = 3; fw = 210; fh = 150; }
    else if (n <= 9)  { cols = 3; fw = 190; fh = 135; }
    else if (n <= 12) { cols = 4; fw = 170; fh = 120; }
    else if (n <= 16) { cols = 4; fw = 150; fh = 107; }
    else if (n <= 20) { cols = 5; fw = 130; fh = 93; }
    else if (n <= 25) { cols = 5; fw = 120; fh = 86; }
    else if (n <= 30) { cols = 6; fw = 110; fh = 78; }
    else { cols = 6; fw = 100; fh = 72; }
    return { cols: cols, fw: fw, fh: fh };
  }

  function build() {
    document.getElementById('gLd').style.display = 'none';
    panels = [];
    loadedCount = 0;

    for (var i = 0; i < albums.length; i++) {
      (function(idx) {
        var a = albums[idx];
        var ph = getPhotos(a);
        var grid = calcGrid(ph.length);

        var panel = document.createElement('div');
        panel.className = 'gallery-panel';

        var wall = document.createElement('div');
        wall.className = 'gallery-wall';

        var spot = document.createElement('div');
        spot.className = 'gallery-spotlight';
        wall.appendChild(spot);

        if (ph.length === 0) {
          var emp = document.createElement('div');
          emp.className = 'gallery-empty';
          emp.textContent = '暂无照片';
          wall.appendChild(emp);
        } else {
          for (var j = 0; j < ph.length; j++) {
            (function(k) {
              var f = document.createElement('div');
              f.className = 'gallery-frame';
              f.style.width = grid.fw + 'px';
              f.style.height = grid.fh + 'px';

              var im = document.createElement('img');
              im.loading = 'lazy';
              im.onload = function() {
                this.classList.add('loaded');
                var nw = this.naturalWidth, nh = this.naturalHeight;
                if (nw && nh) {
                  var baseW = grid.fw, baseH = grid.fh;
                  var ar = nw / nh;
                  if (ar > 1.4) {
                    this.parentElement.style.width = Math.round(baseW * 1.25) + 'px';
                    this.parentElement.style.height = Math.round(baseH) + 'px';
                  } else if (ar < 0.7) {
                    this.parentElement.style.width = Math.round(baseW) + 'px';
                    this.parentElement.style.height = Math.round(baseH * 1.25) + 'px';
                  }
                }
                loadedCount++;
              };
              im.onerror = function() { this.style.display = 'none'; loadedCount++; };
              im.src = ph[k].url.replace('/f_auto,q_auto/', '/w_500,f_auto,q_auto:eco/');
              im.alt = '';
              f.appendChild(im);
              wall.appendChild(f);
            })(j);
          }
        }

        wall.addEventListener('click', function() {
          window.location.href = '/album/' + encodeURIComponent(a.url);
        });

        panel.appendChild(wall);
        track.appendChild(panel);
        panels.push(panel);
      })(i);
    }

    current = 0;
    go(0);
  }

  window.toggleGallery = function() { if (active) exit(); else enter(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
