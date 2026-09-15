const links = Array.from(document.querySelectorAll('nav a'));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => {
        const active = link.hash === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, {rootMargin: '-10% 0px -65% 0px'});
  links.forEach(link => { const section = document.querySelector(link.hash); if (section) observer.observe(section); });
}
