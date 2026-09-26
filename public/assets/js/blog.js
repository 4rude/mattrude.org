/*
 * blog.js: turns the spelled-out contact address into a mailto: link.
 *
 * The page carries the address only as "name at domain dot tld" text plus
 * two data attributes. The full address is joined here, in the browser.
 * Without JavaScript, visitors and screen readers get the spelled-out text.
 */
document.querySelectorAll('.email[data-user][data-domain]').forEach(function (el) {
  var address = el.dataset.user + '@' + el.dataset.domain;
  var link = document.createElement('a');
  link.href = 'mailto:' + address;
  link.textContent = address;
  el.replaceWith(link);
});
