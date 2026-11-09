type RomanSymbol = {
  value: number;
  numeral: string;
};

const ROMAN_SYMBOLS: RomanSymbol[] = [
  { value: 1000, numeral: 'M' },
  { value: 900, numeral: 'CM' },
  { value: 500, numeral: 'D' },
  { value: 400, numeral: 'CD' },
  { value: 100, numeral: 'C' },
  { value: 90, numeral: 'XC' },
  { value: 50, numeral: 'L' },
  { value: 40, numeral: 'XL' },
  { value: 10, numeral: 'X' },
  { value: 9, numeral: 'IX' },
  { value: 5, numeral: 'V' },
  { value: 4, numeral: 'IV' },
  { value: 1, numeral: 'I' },
];

/** Roman numeral for a 1-based position; anything below 1 (or not whole) falls back to plain digits. */
export function toRoman(position: number): string {
  if (!Number.isInteger(position) || position < 1) return String(position);
  let remaining = position;
  let numeral = '';
  for (const symbol of ROMAN_SYMBOLS) {
    while (remaining >= symbol.value) {
      numeral += symbol.numeral;
      remaining -= symbol.value;
    }
  }
  return numeral;
}
