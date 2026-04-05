const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/z/my-project/skills/pptx/scripts/html2pptx');
const path = require('path');

async function createPresentation() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'ForexYemeni';
  pptx.title = 'فوركس يمني - عرض تقديمي';
  pptx.subject = 'محفظة USDT الرقمية';

  const dir = '/home/z/my-project/workspace/slides';
  const slides = [
    'slide1-cover.html',
    'slide2-about.html',
    'slide3-features.html',
    'slide4-transfer.html',
    'slide5-security.html',
    'slide6-p2p.html',
    'slide7-admin.html',
    'slide8-closing.html',
  ];

  for (const file of slides) {
    console.log('Processing:', file);
    await html2pptx(path.join(dir, file), pptx);
  }

  const outputPath = '/home/z/my-project/download/ForexYemeni-Presentation.pptx';
  await pptx.writeFile({ fileName: outputPath });
  console.log('Presentation saved to:', outputPath);
}

createPresentation().catch(console.error);
