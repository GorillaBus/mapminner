const model = (mongoose) => {
  let BmpSchema = new mongoose.Schema({
      file: { type: String, required: true },
      date: { type: Date, required: true },
      zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true }
  });
  let model = mongoose.model("Bmp", BmpSchema);
  return model;
};

module.exports = model;
