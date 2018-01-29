const model = (mongoose) => {
  let AreaSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    order: { type: Number, required: true },
    long: { type: Number, required: true },
    lat: { type: Number, required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true }
  });
  let model = mongoose.model("Area", AreaSchema);

  return model;
};

module.exports = model;
