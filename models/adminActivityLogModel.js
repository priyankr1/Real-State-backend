import mongoose from 'mongoose';

const adminActivityLogSchema = new mongoose.Schema({
  adminEmail: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'approve_property',
      'reject_property',
      'delete_property',
      'bulk_approve_properties',
      'bulk_reject_properties',
      'bulk_delete_properties',
      'suspend_user',
      'ban_user',
      'unban_user',
      'delete_user',
      'bulk_suspend_users',
      'bulk_ban_users',
      'blog_created',
      'blog_updated',
      'blog_deleted',
      'media_created',
      'media_updated',
      'media_deleted',
      'gallery_created',
      'gallery_updated',
      'gallery_deleted',
      'association_created',
      'association_updated',
      'association_deleted',
      'legal_updated',
      'enquiry_deleted'
    ]
  },
  targetType: {
    type: String,
    required: true,
    enum: ['property', 'user', 'appointment', 'blog', 'media', 'gallery', 'association', 'legal', 'enquiry']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetType'
  },
  targetName: {
    type: String,
    default: ''
  },
  metadata: {
    reason: String,
    count: Number,
    affectedIds: [mongoose.Schema.Types.ObjectId],
    previousStatus: String,
    newStatus: String,
    days: Number,
    status: String
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
adminActivityLogSchema.index({ adminEmail: 1, createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetType: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetId: 1 });
adminActivityLogSchema.index({ createdAt: -1 });

const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivityLogSchema);

export default AdminActivityLog;
