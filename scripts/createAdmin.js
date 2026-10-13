import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from '../lib/mysqlMongoose.js';
import { Admin } from '../models/userModel.js';

// Load environment variables
dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const createAdminUser = async () => {
  try {
    await mongoose.connect();
    console.log('Connected to MySQL');

    // Check if admin user already exists
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Validate environment variables
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
    }

    // Create new admin user (password will be hashed by pre-save middleware)
    const admin = new Admin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email:', process.env.ADMIN_EMAIL);
    console.log('Password has been hashed and stored securely');

  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('MySQL connection closed');
  }
};

// Run the migration
createAdminUser();
