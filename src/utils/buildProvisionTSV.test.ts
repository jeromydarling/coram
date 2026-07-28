import { describe, it, expect } from 'vitest';
import { buildProvisionTSV, HEADERS, ProvisionForTSV, ProvisionItemForTSV } from './buildProvisionTSV';

const makeProvision = (overrides?: Partial<ProvisionForTSV>): ProvisionForTSV => ({
  invoice_type: 'Due',
  invoice_date: '2026-02-18',
  business_unit: 'Chicago',
  client_id: 'C-1001',
  business_name: 'Access to Care',
  business_address: '123 Main St',
  business_city: 'Westchester',
  business_state: 'Illinois',
  business_zip: '60154',
  contact_name: 'Jane Doe',
  contact_email: 'jane@example.com',
  payment_due_date: '2026-03-20',
  paid: false,
  date_paid: null,
  ...overrides,
});

const makeItem = (overrides?: Partial<ProvisionItemForTSV>): ProvisionItemForTSV => ({
  product_name: 'Desktop Good',
  gl_account: '4200',
  quantity: 5,
  unit_price_cents: 12500,
  ...overrides,
});

describe('buildProvisionTSV', () => {
  it('produces correct header order', () => {
    const tsv = buildProvisionTSV(makeProvision(), [makeItem()], 'user@test.com');
    const headerLine = tsv.split('\n')[0];
    const headers = headerLine.split('\t');
    expect(headers).toEqual([...HEADERS]);
  });

  it('row count equals number of items plus header', () => {
    const items = [makeItem(), makeItem({ product_name: 'Laptop Better', quantity: 3, unit_price_cents: 50000 })];
    const tsv = buildProvisionTSV(makeProvision(), items, 'user@test.com');
    const lines = tsv.split('\n');
    expect(lines.length).toBe(3); // 1 header + 2 items
  });

  it('no tabs or newlines inside cell content', () => {
    const provision = makeProvision({ business_name: "Org\twith\ttabs\nand\nnewlines" });
    const item = makeItem({ product_name: "Product\twith\ttab" });
    const tsv = buildProvisionTSV(provision, [item], 'user@test.com');
    const lines = tsv.split('\n');
    // Data rows should have exactly 20 tabs (21 columns)
    for (let i = 1; i < lines.length; i++) {
      const tabCount = (lines[i].match(/\t/g) || []).length;
      expect(tabCount).toBe(20);
    }
  });

  it('formats money correctly', () => {
    const item = makeItem({ quantity: 3, unit_price_cents: 12500 });
    const tsv = buildProvisionTSV(makeProvision(), [item], 'user@test.com');
    const row = tsv.split('\n')[1].split('\t');
    // Cost Per Unit (index 15)
    expect(row[15]).toBe('125.00');
    // Total (index 16) = 3 * 125.00 = 375.00
    expect(row[16]).toBe('375.00');
  });

  it('line total is per-item, not invoice total', () => {
    const items = [
      makeItem({ quantity: 2, unit_price_cents: 10000 }),
      makeItem({ quantity: 1, unit_price_cents: 20000 }),
    ];
    const tsv = buildProvisionTSV(makeProvision(), items, 'user@test.com');
    const rows = tsv.split('\n').slice(1);
    expect(rows[0].split('\t')[16]).toBe('200.00'); // 2 * 100
    expect(rows[1].split('\t')[16]).toBe('200.00'); // 1 * 200
  });

  it('copy rows-only excludes header', () => {
    const tsv = buildProvisionTSV(makeProvision(), [makeItem()], 'user@test.com', { includeHeader: false });
    const lines = tsv.split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).not.toContain('Type\t');
  });

  it('uses item_name fallback when product_name is null', () => {
    const item = makeItem({ product_name: null, item_name: 'Fallback Name' });
    const tsv = buildProvisionTSV(makeProvision(), [item], 'user@test.com');
    const row = tsv.split('\n')[1].split('\t');
    expect(row[12]).toBe('Fallback Name');
  });

  it('handles paid=true and date_paid', () => {
    const provision = makeProvision({ paid: true, date_paid: '2026-03-01' });
    const tsv = buildProvisionTSV(provision, [makeItem()], 'user@test.com');
    const row = tsv.split('\n')[1].split('\t');
    expect(row[19]).toBe('TRUE');
    expect(row[20]).toBe('2026-03-01');
  });

  it('collapses repeated whitespace in sanitized fields', () => {
    const provision = makeProvision({ business_name: '  Lots   of   spaces  ' });
    const tsv = buildProvisionTSV(provision, [makeItem()], 'user@test.com');
    const row = tsv.split('\n')[1].split('\t');
    expect(row[5]).toBe('Lots of spaces');
  });

  it('outputs correct hotspot product naming in TSV', () => {
    const hotspotItem = makeItem({
      product_name: '5G Hotspot — Premium — 12mo (Device + Service)',
      gl_account: null,
      quantity: 2,
      unit_price_cents: 22500,
    });
    const tsv = buildProvisionTSV(makeProvision(), [hotspotItem], 'user@test.com');
    const row = tsv.split('\n')[1].split('\t');
    expect(row[12]).toBe('5G Hotspot — Premium — 12mo (Device + Service)');
    expect(row[14]).toBe('2');
    expect(row[15]).toBe('225.00');
    expect(row[16]).toBe('450.00');
  });

  it('mixes computer and hotspot items correctly', () => {
    const items = [
      makeItem({ product_name: 'Desktop Good', quantity: 1, unit_price_cents: 10000 }),
      makeItem({ product_name: '4G Hotspot — 6mo (Service Only)', quantity: 3, unit_price_cents: 7500 }),
    ];
    const tsv = buildProvisionTSV(makeProvision(), items, 'user@test.com');
    const lines = tsv.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[1].split('\t')[12]).toBe('Desktop Good');
    expect(lines[2].split('\t')[12]).toBe('4G Hotspot — 6mo (Service Only)');
  });
});
