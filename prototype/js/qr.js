(() => {
  'use strict';

  // Minimal local QR encoder for the prototype. Fixed at QR version 15-L
  // (523 data bytes). Session-store limits keep generated links within a reliably scannable budget.
  const TYPE_NUMBER = 15;
  const ERROR_LEVEL = 1; // L
  const MODULE_COUNT = TYPE_NUMBER * 4 + 17;
  const ALIGNMENT = [6, 26, 48, 70];
  const RS_BLOCKS = [
    { total: 109, data: 87 },
    { total: 109, data: 87 },
    { total: 109, data: 87 },
    { total: 109, data: 87 },
    { total: 109, data: 87 },
    { total: 110, data: 88 }
  ];
  const PAD0 = 0xec;
  const PAD1 = 0x11;
  const G15 = 0x0537;
  const G18 = 0x1f25;
  const G15_MASK = 0x5412;

  const EXP = new Array(512);
  const LOG = new Array(256);
  for (let i = 0; i < 8; i += 1) EXP[i] = 1 << i;
  for (let i = 8; i < 256; i += 1) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
  for (let i = 0; i < 255; i += 1) LOG[EXP[i]] = i;
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

  const gfMul = (a, b) => {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  };

  const polyMultiply = (a, b) => {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < b.length; j += 1) out[i + j] ^= gfMul(a[i], b[j]);
    }
    return out;
  };

  const generatorPolynomial = (degree) => {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) poly = polyMultiply(poly, [1, EXP[i]]);
    return poly;
  };

  const rsRemainder = (data, degree) => {
    const generator = generatorPolynomial(degree);
    const result = [...data, ...new Array(degree).fill(0)];
    for (let i = 0; i < data.length; i += 1) {
      const factor = result[i];
      if (!factor) continue;
      for (let j = 0; j < generator.length; j += 1) result[i + j] ^= gfMul(generator[j], factor);
    }
    return result.slice(data.length);
  };

  class BitBuffer {
    constructor() { this.bits = []; }
    put(value, length) {
      for (let i = length - 1; i >= 0; i -= 1) this.bits.push(((value >>> i) & 1) === 1);
    }
    putBytes(bytes) { bytes.forEach((byte) => this.put(byte, 8)); }
    toBytes() {
      const bytes = [];
      for (let i = 0; i < this.bits.length; i += 8) {
        let value = 0;
        for (let j = 0; j < 8; j += 1) if (this.bits[i + j]) value |= 0x80 >>> j;
        bytes.push(value);
      }
      return bytes;
    }
  }

  const dataCodewords = (text) => {
    const bytes = [...new TextEncoder().encode(text)];
    const capacity = RS_BLOCKS.reduce((sum, block) => sum + block.data, 0);
    if (bytes.length > capacity - 4) throw new Error('The generated examination link is too long for the local QR encoder.');

    const buffer = new BitBuffer();
    buffer.put(0b0100, 4); // byte mode
    buffer.put(bytes.length, 16); // versions 10-26 use 16 count bits in byte mode
    buffer.putBytes(bytes);
    const maxBits = capacity * 8;
    const terminator = Math.min(4, maxBits - buffer.bits.length);
    for (let i = 0; i < terminator; i += 1) buffer.bits.push(false);
    while (buffer.bits.length % 8) buffer.bits.push(false);
    let output = buffer.toBytes();
    let pad = true;
    while (output.length < capacity) {
      output.push(pad ? PAD0 : PAD1);
      pad = !pad;
    }
    return output;
  };

  const interleave = (data) => {
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    RS_BLOCKS.forEach((block) => {
      const chunk = data.slice(offset, offset + block.data);
      offset += block.data;
      dataBlocks.push(chunk);
      ecBlocks.push(rsRemainder(chunk, block.total - block.data));
    });
    const out = [];
    const maxData = Math.max(...dataBlocks.map((block) => block.length));
    const maxEc = Math.max(...ecBlocks.map((block) => block.length));
    for (let i = 0; i < maxData; i += 1) dataBlocks.forEach((block) => { if (i < block.length) out.push(block[i]); });
    for (let i = 0; i < maxEc; i += 1) ecBlocks.forEach((block) => { if (i < block.length) out.push(block[i]); });
    return out;
  };

  const bchDigit = (value) => {
    let digit = 0;
    while (value) { digit += 1; value >>>= 1; }
    return digit;
  };

  const bchTypeInfo = (data) => {
    let value = data << 10;
    while (bchDigit(value) - bchDigit(G15) >= 0) value ^= G15 << (bchDigit(value) - bchDigit(G15));
    return ((data << 10) | value) ^ G15_MASK;
  };

  const bchTypeNumber = (data) => {
    let value = data << 12;
    while (bchDigit(value) - bchDigit(G18) >= 0) value ^= G18 << (bchDigit(value) - bchDigit(G18));
    return (data << 12) | value;
  };

  const maskValue = (pattern, row, col) => {
    switch (pattern) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
      case 6: return ((((row * col) % 2) + ((row * col) % 3)) % 2) === 0;
      case 7: return ((((row * col) % 3) + ((row + col) % 2)) % 2) === 0;
      default: return false;
    }
  };

  const createMatrix = () => Array.from({ length: MODULE_COUNT }, () => new Array(MODULE_COUNT).fill(null));

  const finder = (matrix, row, col) => {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r < 0 || row + r >= MODULE_COUNT) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c < 0 || col + c >= MODULE_COUNT) continue;
        const dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[row + r][col + c] = dark;
      }
    }
  };

  const alignment = (matrix) => {
    ALIGNMENT.forEach((row) => ALIGNMENT.forEach((col) => {
      if (matrix[row][col] !== null) return;
      for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) matrix[row + r][col + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }));
  };

  const timing = (matrix) => {
    for (let i = 8; i < MODULE_COUNT - 8; i += 1) {
      if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
      if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    }
  };

  const typeInfo = (matrix, test, pattern) => {
    const bits = bchTypeInfo((ERROR_LEVEL << 3) | pattern);
    for (let i = 0; i < 15; i += 1) {
      const dark = !test && ((bits >> i) & 1) === 1;
      if (i < 6) matrix[i][8] = dark;
      else if (i < 8) matrix[i + 1][8] = dark;
      else matrix[MODULE_COUNT - 15 + i][8] = dark;
    }
    for (let i = 0; i < 15; i += 1) {
      const dark = !test && ((bits >> i) & 1) === 1;
      if (i < 8) matrix[8][MODULE_COUNT - i - 1] = dark;
      else if (i < 9) matrix[8][15 - i] = dark;
      else matrix[8][15 - i - 1] = dark;
    }
    matrix[MODULE_COUNT - 8][8] = !test;
  };

  const typeNumber = (matrix, test) => {
    const bits = bchTypeNumber(TYPE_NUMBER);
    for (let i = 0; i < 18; i += 1) {
      const dark = !test && ((bits >> i) & 1) === 1;
      matrix[Math.floor(i / 3)][(i % 3) + MODULE_COUNT - 11] = dark;
      matrix[(i % 3) + MODULE_COUNT - 11][Math.floor(i / 3)] = dark;
    }
  };

  const mapData = (matrix, bytes, pattern) => {
    let row = MODULE_COUNT - 1;
    let direction = -1;
    let byteIndex = 0;
    let bitIndex = 7;
    for (let col = MODULE_COUNT - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      while (true) {
        for (let c = 0; c < 2; c += 1) {
          const targetCol = col - c;
          if (matrix[row][targetCol] !== null) continue;
          let dark = false;
          if (byteIndex < bytes.length) dark = ((bytes[byteIndex] >>> bitIndex) & 1) === 1;
          if (maskValue(pattern, row, targetCol)) dark = !dark;
          matrix[row][targetCol] = dark;
          bitIndex -= 1;
          if (bitIndex === -1) { byteIndex += 1; bitIndex = 7; }
        }
        row += direction;
        if (row < 0 || row >= MODULE_COUNT) {
          row -= direction;
          direction = -direction;
          break;
        }
      }
    }
  };

  const buildMatrix = (bytes, pattern, test = false) => {
    const matrix = createMatrix();
    finder(matrix, 0, 0);
    finder(matrix, MODULE_COUNT - 7, 0);
    finder(matrix, 0, MODULE_COUNT - 7);
    alignment(matrix);
    timing(matrix);
    typeInfo(matrix, test, pattern);
    typeNumber(matrix, test);
    mapData(matrix, bytes, pattern);
    return matrix;
  };

  const lostPoint = (matrix) => {
    const size = matrix.length;
    let score = 0;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        let same = 0;
        const dark = matrix[row][col];
        for (let r = -1; r <= 1; r += 1) for (let c = -1; c <= 1; c += 1) {
          if (!r && !c) continue;
          const rr = row + r; const cc = col + c;
          if (rr >= 0 && rr < size && cc >= 0 && cc < size && matrix[rr][cc] === dark) same += 1;
        }
        if (same > 5) score += 3 + same - 5;
      }
    }
    for (let row = 0; row < size - 1; row += 1) for (let col = 0; col < size - 1; col += 1) {
      const count = Number(matrix[row][col]) + Number(matrix[row + 1][col]) + Number(matrix[row][col + 1]) + Number(matrix[row + 1][col + 1]);
      if (count === 0 || count === 4) score += 3;
    }
    for (let row = 0; row < size; row += 1) for (let col = 0; col < size - 6; col += 1) if (matrix[row][col] && !matrix[row][col + 1] && matrix[row][col + 2] && matrix[row][col + 3] && matrix[row][col + 4] && !matrix[row][col + 5] && matrix[row][col + 6]) score += 40;
    for (let col = 0; col < size; col += 1) for (let row = 0; row < size - 6; row += 1) if (matrix[row][col] && !matrix[row + 1][col] && matrix[row + 2][col] && matrix[row + 3][col] && matrix[row + 4][col] && !matrix[row + 5][col] && matrix[row + 6][col]) score += 40;
    let darkCount = 0;
    matrix.forEach((line) => line.forEach((cell) => { if (cell) darkCount += 1; }));
    score += Math.abs((100 * darkCount / size / size) - 50) / 5 * 10;
    return score;
  };

  const matrixFor = (text) => {
    const codewords = interleave(dataCodewords(text));
    let bestPattern = 0;
    let bestScore = Infinity;
    for (let pattern = 0; pattern < 8; pattern += 1) {
      const score = lostPoint(buildMatrix(codewords, pattern, true));
      if (score < bestScore) { bestScore = score; bestPattern = pattern; }
    }
    return buildMatrix(codewords, bestPattern, false);
  };

  const svgFor = (text) => {
    const matrix = matrixFor(text);
    const margin = 4;
    const size = matrix.length + margin * 2;
    let path = '';
    for (let row = 0; row < matrix.length; row += 1) for (let col = 0; col < matrix.length; col += 1) if (matrix[row][col]) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for the dynamic examination link" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`;
  };

  const render = (element, text) => {
    if (!element) throw new Error('QR target element is missing.');
    element.innerHTML = svgFor(String(text));
    const svg = element.querySelector('svg');
    if (svg) svg.classList.add('h-auto', 'w-full');
  };

  window.FestacolQR = Object.freeze({ render, svgFor });
})();
