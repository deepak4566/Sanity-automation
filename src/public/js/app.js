// ShopNova Client Application Script
async function addToCart(productId, name, price) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, name, price, quantity: 1 })
    });
    const data = await res.json();
    if (data.success) {
      const counter = document.getElementById('cart-counter');
      if (counter) counter.textContent = data.count;
      showToast(`Added "${name}" to cart!`);
    }
  } catch (err) {
    console.warn('Cart update notice:', err.message);
  }
}

function showToast(message) {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1e293b;
    color: #fff;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    animation: fadeIn 0.2s ease-in;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

window.addToCart = addToCart;
