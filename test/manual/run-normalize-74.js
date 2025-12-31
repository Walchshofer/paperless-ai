(async ()=>{
  console.log('Starting normalization run for doc 74');
  try{
    const { preVisionNormalizer } = require('../../services/experts/normalization/PreVisionNormalizer');
    const res = await preVisionNormalizer.analyzeAndNormalize(74);
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error during normalization:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
