let loading;

function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Check your internet connection.'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for an order created by the API.
 * Resolves with { orderId, paymentId, signature } on success, rejects if dismissed or failed.
 */
export async function openCheckout(order, { description, color = '#0f766e' } = {}) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description,
      prefill: order.prefill,
      theme: { color },
      handler: (r) => resolve({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rz.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
    rz.open();
  });
}
