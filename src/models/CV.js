import mongoose from 'mongoose';

const CVSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { strict: false, timestamps: true }
);

export default mongoose.models.CV || mongoose.model('CV', CVSchema, 'master_cvs');
