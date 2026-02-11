export default function decorate(block) {
  const $picture = block.querySelector('picture');
  const $title = block.querySelector('h1');

  if ($picture) {
    const $img = $picture.querySelector('img');
    if ($img) {
      $img.setAttribute('fetchpriority', 'high');
      $img.setAttribute('loading', 'eager');
      $img.setAttribute('decoding', 'sync');
    }
  }

  block.innerHTML = '';

  block.appendChild($title);
  block.appendChild($picture);
}
