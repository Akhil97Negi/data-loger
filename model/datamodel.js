import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    name: String,
    score: Number,
    age: Number,
    city: String,
    gender: String
});

export const Data = mongoose.model('Entry', dataSchema);


