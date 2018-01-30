const model = (mongoose, models) => {
  let LogSchema = new mongoose.Schema({
    time: { type: Number, required: true },
    date: { type: Date, required: true },
    month_str: { type: String, required: true },
    day_str: { type: String, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    day: { type: Number, required: true },
    hour: { type: Number, required: true },
    minute: { type: Number, required: true },
    reg: {
      hi: { type: Number, default: 0 },
      mid: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      null: { type: Number, default: 0 }
    },
    score: { type: Number, default: 0 },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true }
  });

  LogSchema.index({ time: 1, area: 1 }, { unique: true, name: "time_1_area_1" });
  LogSchema.set('autoIndex', false);

  let model = mongoose.model("Log", LogSchema);

  return model;
};

module.exports = model;
