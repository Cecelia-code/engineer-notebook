const searchInput = document.querySelector("[data-search-input]");
const resultLabel = document.querySelector("[data-filter-result]");
const postGrid = document.querySelector("[data-post-grid]");
const tagButtons = [...document.querySelectorAll("[data-filter-tag]")];

if (postGrid && searchInput && resultLabel && tagButtons.length) {
  const cards = [...postGrid.querySelectorAll("[data-post-card]")];
  let activeTag = "";

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    for (const card of cards) {
      const haystack = [
        card.dataset.title || "",
        card.dataset.summary || "",
        card.dataset.tags || ""
      ]
        .join(" ")
        .toLowerCase();

      const tagMatch = !activeTag || (card.dataset.tags || "").includes(activeTag);
      const queryMatch = !query || haystack.includes(query);
      const visible = tagMatch && queryMatch;

      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    resultLabel.textContent = `显示 ${visibleCount} 篇内容`;
  }

  for (const button of tagButtons) {
    button.addEventListener("click", () => {
      activeTag = button.dataset.filterTag || "";
      for (const peer of tagButtons) {
        peer.classList.toggle("is-active", peer === button);
      }
      applyFilters();
    });
  }

  searchInput.addEventListener("input", applyFilters);
}
