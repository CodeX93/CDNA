import express from "express";
import JobSeeker from "../model/JobSeeker.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    let user = await JobSeeker.findOne({ email });
    if (!user) {
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });
    }

    // Create and sign JWT
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "5d" },
      (err, token) => {
        if (err) throw err;
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days
        });
        res.json({
          _id: user._id,
          name: user.fullName,
          email: user.email,
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/auth/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await JobSeeker.findById(decoded.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const userProfile = user.toObject();
    userProfile.name = userProfile.fullName;
    res.json(userProfile);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// @route   PUT api/auth/profile
// @desc    Update current user's profile (except email and password)
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await JobSeeker.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    // Only update allowed fields
    const updatableFields = [
      'fullName', 'headline', 'bio', 'website', 'github', 'gitlab', 'linkedin',
      'experienceLevel', 'visibility', 'workCategories', 'skills', 'imageUrl'
    ];
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });
    await user.save();
    const userProfile = user.toObject();
    delete userProfile.password;
    userProfile.name = userProfile.fullName;
    res.json(userProfile);
  } catch (err) {
    console.error(err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
});


// @route   POST api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ msg: 'Logged out successfully' });
});


export default router; 