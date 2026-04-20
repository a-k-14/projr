import fs from 'node:fs';

describe('starter data seed', () => {
  const seedSource = fs.readFileSync('db/seed.ts', 'utf8');

  it('does not create starter transactions or loans', () => {
    expect(seedSource).not.toMatch(/createTransaction\s*\(/);
    expect(seedSource).not.toMatch(/createLoan\s*\(/);
  });
});
