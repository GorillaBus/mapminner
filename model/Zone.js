const model = (mongoose) => {
  let ZoneSchema = new mongoose.Schema({
      long: { type: Number, required: true },
      lat: { type: Number, required: true },
      code: { type: String, required: true },
      areas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true }]
  });
  let model = mongoose.model("Zone", ZoneSchema);

  return model;
};

module.exports = model;
