// server/utils/grammarScore.js (updated)
const axios = require('axios');

module.exports = async function(sentence) {
  try {
    const res = await axios.post('https://api.languagetoolplus.com/v2/check',
      new URLSearchParams({
        text: sentence,
        language: 'en-US'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const matches = res.data.matches;
    if (matches.length === 0) return 100; // Only perfect for NO errors

    // Penalize depending on error type.
    let penalty = 0;
    matches.forEach(({ rule }) => {
      if (rule.issueType === "grammar") penalty += 15;
      else if (rule.issueType === "agreement") penalty += 12;
      else if (rule.issueType === "typographical") penalty += 5;
      else penalty += 10;
    });

    const score = Math.max(100 - penalty, 10);
    return score;
  } catch (e) {
    return 50;
  }
};
