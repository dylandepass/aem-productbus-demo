const AUTOPLAY_INTERVAL = 5000;

/**
 * Auto-rotating image carousel block.
 * @param {HTMLElement} block - The carousel block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  // Build slides
  const slidesContainer = document.createElement('div');
  slidesContainer.className = 'carousel-slides';

  const slides = rows.map((row, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    if (i === 0) slide.classList.add('active');

    // Extract picture from the row's cell structure
    const pic = row.querySelector('picture');
    if (pic) {
      const img = pic.querySelector('img');
      if (img) img.loading = i === 0 ? 'eager' : 'lazy';
      slide.append(pic);
    }

    slidesContainer.append(slide);
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

  function goToSlide(index) {
    slides[current].classList.remove('active');
    dotButtons[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    dotButtons[current].classList.add('active');
  }

  function advance() {
    goToSlide((current + 1) % slides.length);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(advance, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  dotButtons.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goToSlide(i);
      startAutoplay(); // reset timer on manual navigation
    });
  });

  // Assemble
  block.innerHTML = '';
  block.append(slidesContainer, dots);

  // Start autoplay
  startAutoplay();

  // Pause on hover
  block.addEventListener('mouseenter', stopAutoplay);
  block.addEventListener('mouseleave', startAutoplay);
}
