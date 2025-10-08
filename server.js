const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Отдаём статику из папки public
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
