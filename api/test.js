module.exports = (req, res) => {
  res.status(200).json({
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
};
