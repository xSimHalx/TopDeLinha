import { formatCurrency, addToCart, updateCartQuantity, resetPdv, products, cart } from './script.js';

QUnit.module('Formatters', function() {
  QUnit.test('formatCurrency should format numbers correctly', function(assert) {
    assert.strictEqual(formatCurrency(123.45), 'R$\xa0123,45', 'Formats a standard number');
    assert.strictEqual(formatCurrency(0), 'R$\xa00,00', 'Formats zero');
    assert.strictEqual(formatCurrency(1000), 'R$\xa01.000,00', 'Formats a number with a thousand separator');
    assert.strictEqual(formatCurrency(99.9), 'R$\xa099,90', 'Formats a number with one decimal place');
  });
});

QUnit.module('Shopping Cart', function(hooks) {
  hooks.beforeEach(function() {
    // Mock products data
    products.length = 0;
    products.push(
      { sku: 'P1', name: 'Product 1', price: 10.00, stock: 5 },
      { sku: 'P2', name: 'Product 2', price: 25.50, stock: 2 },
      { sku: 'P3', name: 'Product 3', price: 5.75, stock: 0 }
    );

    // Reset cart before each test
    cart.length = 0;

    // Mock the showModal function to avoid errors
    window.showModal = function() {};
  });

  QUnit.test('addToCart should add a new item to the cart', function(assert) {
    addToCart('P1');
    assert.strictEqual(cart.length, 1, 'Cart should have one item');
    assert.strictEqual(cart[0].sku, 'P1', 'The correct item should be in the cart');
    assert.strictEqual(cart[0].quantity, 1, 'Item quantity should be 1');
  });

  QUnit.test('addToCart should increment the quantity of an existing item', function(assert) {
    addToCart('P1');
    addToCart('P1');
    assert.strictEqual(cart.length, 1, 'Cart should still have one item');
    assert.strictEqual(cart[0].quantity, 2, 'Item quantity should be 2');
  });

  QUnit.test('addToCart should not add an item if stock is zero', function(assert) {
    addToCart('P3');
    assert.strictEqual(cart.length, 0, 'Cart should be empty');
  });

  QUnit.test('addToCart should not add more items than available in stock', function(assert) {
    // P2 has stock of 2
    addToCart('P2');
    addToCart('P2');
    addToCart('P2'); // Try to add a 3rd one
    assert.strictEqual(cart.find(p => p.sku === 'P2').quantity, 2, 'Cart quantity should be limited by stock');
  });

  QUnit.test('addToCart should call showModal for invalid SKU', function(assert) {
    const done = assert.async();
    // Spy on showModal
    const originalShowModal = window.showModal;
    window.showModal = function(title, message) {
      assert.strictEqual(title, 'Erro de Produto', 'showModal should be called with an error title');
      assert.ok(message.includes('não foi encontrado'), 'showModal should be called with an error message');
      window.showModal = originalShowModal; // Restore original function
      done();
    };
    addToCart('INVALID_SKU');
    // If showModal is not called, the test will time out and fail, which is what we want.
  });

  QUnit.test('updateCartQuantity should increase the quantity of an item', function(assert) {
    addToCart('P2');
    updateCartQuantity('P2', 1);
    assert.strictEqual(cart[0].quantity, 2, 'Item quantity should be increased to 2');
  });

  QUnit.test('updateCartQuantity should not increase quantity beyond available stock', function(assert) {
    // P2 has stock of 2
    addToCart('P2');
    updateCartQuantity('P2', 1); // Quantity is now 2
    updateCartQuantity('P2', 1); // Try to increase to 3
    assert.strictEqual(cart.find(p => p.sku === 'P2').quantity, 2, 'Cart quantity should not exceed stock');
  });

  QUnit.test('updateCartQuantity should decrease the quantity of an item', function(assert) {
    addToCart('P1');
    addToCart('P1');
    updateCartQuantity('P1', -1);
    assert.strictEqual(cart[0].quantity, 1, 'Item quantity should be decreased to 1');
  });

  QUnit.test('updateCartQuantity should remove an item if quantity becomes zero', function(assert) {
    addToCart('P1');
    updateCartQuantity('P1', -1);
    assert.strictEqual(cart.length, 0, 'Cart should be empty after quantity becomes 0');
  });

  QUnit.test('updateCartQuantity should remove an item if quantity becomes less than zero', function(assert) {
    addToCart('P2');
    updateCartQuantity('P2', -2);
    assert.strictEqual(cart.length, 0, 'Cart should be empty after quantity becomes less than 0');
  });

  QUnit.test('resetPdv should clear the cart', function(assert) {
    addToCart('P1');
    addToCart('P2');
    resetPdv();
    assert.strictEqual(cart.length, 0, 'Cart should be empty after reset');
  });
});
