const AUTOPLAY_INTERVAL = 3000;
const TRANSITION_MS = 600;

/**
 * Auto-rotating image carousel block with slide animation.
 * @param {HTMLElement} block - The carousel block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  // Build slides
  const track = document.createElement('div');
  track.className = 'carousel-track';

  const slides = rows.map((row, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';

    const pic = row.querySelector('picture');
    if (pic) {
      const img = pic.querySelector('img');
      if (img) img.loading = i === 0 ? 'eager' : 'lazy';
      slide.append(pic);
    }

    track.append(slide);
    return slide;
  });

  // Build dot indicators
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  const dotButtons = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    if (i === 0) dot.classList.add('active');
    dots.append(dot);
    return dot;
  });

  // Navigation
  let current = 0;
  let timer;
  let animating = false;

  function goToSlide(index) {
    if (animating || index === current) return;
    animating = true;

    dotButtons[current].classList.remove('active');
    dotButtons[index].classList.add('active');

    track.style.transform = `translateX(-${index * 100}%)`;

    current = index;

    setTimeout(() => {
      animating = false;
    }, TRANSITION_MS);
  }

  function advance() {
    goToSlide((current + 1) % slides.length);
  }

  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(advance, AUTOPLAY_INTERVAL);
  }

  dotButtons.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goToSlide(i);
      startAutoplay();
    });
  });

  // Assemble
  block.innerHTML = '';
  block.append(track, dots);

  // Start autoplay
  startAutoplay();

  // Pause on hover
  block.addEventListener('mouseenter', stopAutoplay);
  block.addEventListener('mouseleave', startAutoplay);
}
