/**
 * Category cards block. Renders promotional cards linking to collection pages.
 * Each row: cell 1 (title, image, description, CTA), cell 2 (link URL).
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  const grid = document.createElement('div');
  grid.className = 'category-cards-grid';

  rows.forEach((row) => {
    const cells = [...row.children];
    const contentCell = cells[0];
    const linkCell = cells[1];

    if (!contentCell) return;

    const href = linkCell?.textContent.trim() || '#';

    // Parse content: first <p> = title, <picture> = image, next <p> = description, <strong> = CTA
    const paragraphs = [...contentCell.querySelectorAll(':scope > p')];
    const picture = contentCell.querySelector('picture');

    let title = '';
    let description = '';
    let ctaText = 'Shop';

    paragraphs.forEach((p) => {
      if (p.querySelector('picture')) return; // skip image paragraph
      const strong = p.querySelector('strong');
      if (strong) {
        ctaText = strong.textContent.trim();
      } else if (!title) {
        title = p.textContent.trim();
      } else {
        description = p.textContent.trim();
      }
    });

    // Build card
    const card = document.createElement('a');
    card.className = 'category-card';
    card.href = href;

    const heading = document.createElement('h3');
    heading.textContent = title;
    card.append(heading);

    if (picture) {
      const imageWrap = document.createElement('div');
      imageWrap.className = 'category-card-image';
      imageWrap.append(picture);
      card.append(imageWrap);
    }

    if (description) {
      const desc = document.createElement('p');
      desc.className = 'category-card-description';
      desc.textContent = description;
      card.append(desc);
    }

    const cta = document.createElement('span');
    cta.className = 'category-card-cta';
    cta.textContent = ctaText;
    card.append(cta);

    grid.append(card);
  });

  block.innerHTML = '';
  block.append(grid);
}
