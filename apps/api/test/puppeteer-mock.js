module.exports = {
  launch: () => Promise.resolve({
    newPage: () => Promise.resolve({
      setContent: () => Promise.resolve(),
      pdf: () => Promise.resolve(Buffer.from('PDF Content')),
    }),
    close: () => Promise.resolve(),
  }),
};
