const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('Test server is running!');
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
