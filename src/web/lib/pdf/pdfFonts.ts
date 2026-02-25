import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake/js/Printer').default;

const fontsDir = path.join(process.cwd(), 'public', 'fonts');

const fontDescriptors = {
  Roboto: {
    normal: fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf')),
    bold: fs.readFileSync(path.join(fontsDir, 'Roboto-Bold.ttf')),
    italics: fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf')),
    bolditalics: fs.readFileSync(path.join(fontsDir, 'Roboto-Bold.ttf')),
  },
};

export const printer = new PdfPrinter(fontDescriptors);
