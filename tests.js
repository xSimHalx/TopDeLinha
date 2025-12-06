// Importa as funções puras diretamente do novo módulo de lógica
import { formatCurrency, parseCurrency, calculateCartTotal } from './pdv_logic.js';

QUnit.module('Currency Logic', function() {
  QUnit.test('formatCurrency should format numbers correctly', function(assert) {
    assert.strictEqual(formatCurrency(123.45), 'R$ 123,45', 'Formats a standard number');
    assert.strictEqual(formatCurrency(0), 'R$ 0,00', 'Formats zero');
    assert.strictEqual(formatCurrency(1000), 'R$ 1.000,00', 'Formats a number with a thousand separator');
    assert.strictEqual(formatCurrency(99.9), 'R$ 99,90', 'Formats a number with one decimal place');
    // Corrigido: Passa um número em vez de uma string ambígua
    assert.strictEqual(formatCurrency(7.5), 'R$ 7,50', 'Formats a float number');
  });

  QUnit.test('parseCurrency should parse strings and numbers correctly', function(assert) {
    assert.strictEqual(parseCurrency('R$ 1.234,56'), 1234.56, 'Parses a formatted pt-BR string');
    // Corrigido: Usa vírgula como decimal, que é o padrão do BRLConfig
    assert.strictEqual(parseCurrency('123,45'), 123.45, 'Parses a string with a comma decimal');
    assert.strictEqual(parseCurrency('99.90'), 99.90, 'Parses a string with a dot decimal (compatibilidade)');
    assert.strictEqual(parseCurrency(50.5), 50.5, 'Handles a number input');
    assert.strictEqual(parseCurrency('invalid'), 0, 'Handles invalid input gracefully');
  });

  QUnit.test('calculateCartTotal should calculate total correctly, avoiding floating point issues', function(assert) {
    const cart1 = [
      { sku: 'P1', name: 'Item A', price: 0.1, quantity: 1 },
      { sku: 'P2', name: 'Item B', price: 0.2, quantity: 1 }
    ];
    const total1 = calculateCartTotal(cart1);
    assert.strictEqual(total1.value, 0.30, 'The total of 0.1 + 0.2 should be precisely 0.30');
    assert.strictEqual(total1.format(), 'R$ 0,30', 'The formatted total of 0.1 + 0.2 should be R$ 0,30');
  });

  QUnit.test('calculateCartTotal should handle multiple items and quantities', function(assert) {
    const cart = [
      { sku: 'P1', name: 'Item A', price: 10.55, quantity: 2 }, // 21.10
      { sku: 'P2', name: 'Item B', price: 5, quantity: 3 },      // 15.00
      { sku: 'P3', name: 'Item C', price: 2.15, quantity: 1 }      //  2.15
    ];
    const total = calculateCartTotal(cart);
    assert.strictEqual(total.value, 38.25, 'The total for multiple items should be correct');
    assert.strictEqual(total.format(), 'R$ 38,25', 'The formatted total should be correct');
  });

  QUnit.test('calculateCartTotal should return zero for an empty cart', function(assert) {
    const cart = [];
    const total = calculateCartTotal(cart);
    assert.strictEqual(total.value, 0, 'Total of an empty cart should be 0');
  });

  QUnit.test('calculateCartTotal should handle items with zero quantity', function(assert) {
    const cart = [
      { sku: 'P1', name: 'Item A', price: 10, quantity: 2 },
      { sku: 'P2', name: 'Item B', price: 20, quantity: 0 }
    ];
    const total = calculateCartTotal(cart);
    assert.strictEqual(total.value, 20, 'Item with zero quantity should not affect the total');
  });
});