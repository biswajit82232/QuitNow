import './style.css'

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Register service worker for PWA (only in production or when not in dev mode)
let serviceWorkerUpdateInterval = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Only register service worker in production build
    // In development, Vite's dev server handles things differently
    const isProduction = import.meta.env.PROD;
    
    if (isProduction || window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          // Check for updates periodically
          serviceWorkerUpdateInterval = setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
          
          // Clear interval on page unload
          window.addEventListener('beforeunload', () => {
            if (serviceWorkerUpdateInterval) {
              clearInterval(serviceWorkerUpdateInterval);
            }
          });
          
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New service worker available, force reload
                    window.location.reload();
                  }
                }
              });
            }
          });
          
          // Check for updates on page load
          registration.update();
          
          // Check for updates when page becomes visible
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
              registration.update();
            }
          });
        })
        .catch((error) => {
          // Silently fail in production
          if (import.meta.env.DEV) {
            console.error('Service Worker registration failed:', error);
          }
        });
    }
  });
  
  // Listen for service worker controller changes
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Default settings (can be customized)
const DEFAULT_CIGARETTES_PER_DAY = 20;
const DEFAULT_COST_PER_PACK = 10;
const CIGARETTES_PER_PACK = 20;

// Motivational tips and messages
const MOTIVATIONAL_TIPS = [
  'Quit Now',
  'Stay Strong',
  'You Can Do It',
  'Keep Going',
  'Stay Committed',
  'You\'re Doing Great',
  'Stay Focused',
  'Keep Fighting',
  'Stay Motivated',
  'You\'ve Got This',
  'Stay Determined',
  'Keep Pushing Forward',
  'Stay Positive',
  'You\'re Stronger Than This',
  'Stay Resilient',
  'Keep Moving Forward',
  'Stay Committed to Your Health',
  'You\'re Winning',
  'Stay Proud',
  'Keep Up the Great Work'
];

// Tip rotation interval
let tipInterval = null;
let currentTipIndex = 0;

// Get quit date from localStorage or set new one
function getQuitDate() {
  try {
    const stored = localStorage.getItem('quitDate');
    if (!stored) return null;
    const date = new Date(stored);
    // Validate date
    if (isNaN(date.getTime())) {
      localStorage.removeItem('quitDate');
      return null;
    }
    return date;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error reading quit date from localStorage:', error);
    }
    return null;
  }
}

// Get nickname from localStorage
function getNickname() {
  try {
    return localStorage.getItem('nickname') || '';
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error reading nickname from localStorage:', error);
    }
    return '';
  }
}

// Set nickname in localStorage
function setNickname(nickname) {
  try {
    if (nickname && nickname.trim()) {
      // Sanitize nickname - remove HTML tags and limit length
      const sanitized = nickname.trim().substring(0, 20).replace(/[<>]/g, '');
      localStorage.setItem('nickname', sanitized);
    } else {
      localStorage.removeItem('nickname');
    }
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      showErrorModal('Storage is full. Please clear some data.');
    }
  }
}

function setQuitDate(date) {
  try {
    if (!date || isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    // Validate date is not too old (more than 50 years ago)
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 50);
    if (date < minDate) {
      throw new Error('Date is too far in the past');
    }
    // Validate date is not in the future
    const now = new Date();
    if (date > now) {
      throw new Error('Date cannot be in the future');
    }
    localStorage.setItem('quitDate', date.toISOString());
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      showErrorModal('Storage is full. Please clear some data or use a different browser.');
    } else {
      showErrorModal('Unable to save quit date. ' + error.message);
    }
  }
}

// Calculate time elapsed
function calculateTimeElapsed(quitDate) {
  const now = new Date();
  const diff = now - quitDate;
  
  // If quit date is in the future or just happened, show zeros
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, totalMs: diff };
}

// Calculate statistics
function calculateStats(quitDate, cigarettesPerDay = DEFAULT_CIGARETTES_PER_DAY, costPerPack = DEFAULT_COST_PER_PACK) {
  try {
    // Get stored preferences if available
    try {
      const storedCigarettes = localStorage.getItem('cigarettesPerDay');
      const storedCost = localStorage.getItem('costPerPack');
      if (storedCigarettes) cigarettesPerDay = parseInt(storedCigarettes) || cigarettesPerDay;
      if (storedCost) costPerPack = parseFloat(storedCost) || costPerPack;
    } catch (e) {
      // Use defaults if localStorage fails
    }
    
    // Use UTC to avoid timezone issues
    const now = new Date();
    const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    const quitUTC = Date.UTC(quitDate.getFullYear(), quitDate.getMonth(), quitDate.getDate(), quitDate.getHours(), quitDate.getMinutes(), quitDate.getSeconds());
    const diff = nowUTC - quitUTC;
    const days = diff / (1000 * 60 * 60 * 24);
    
    // Only show positive values if time has passed
    if (diff <= 0 || days < 0 || isNaN(days)) {
      return {
        cigarettesAvoided: 0,
        packsAvoided: 0,
        moneySaved: '0.00',
        daysQuit: 0
      };
    }
    
    // Prevent overflow for very large numbers
    const maxDays = 36500; // ~100 years
    const safeDays = Math.min(days, maxDays);
    
    const cigarettesAvoided = Math.floor(safeDays * cigarettesPerDay);
    const packsAvoided = Math.floor(cigarettesAvoided / CIGARETTES_PER_PACK);
    const moneySaved = Math.min(packsAvoided * costPerPack, 999999999.99).toFixed(2);
    
    return {
      cigarettesAvoided,
      packsAvoided,
      moneySaved,
      daysQuit: Math.floor(safeDays)
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error calculating stats:', error);
    }
    return {
      cigarettesAvoided: 0,
      packsAvoided: 0,
      moneySaved: '0.00',
      daysQuit: 0
    };
  }
}

// Calculate health regeneration progress
function calculateHealthRegeneration(quitDate) {
  const now = new Date();
  // Use UTC to avoid timezone issues
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  const quitUTC = Date.UTC(quitDate.getFullYear(), quitDate.getMonth(), quitDate.getDate(), quitDate.getHours(), quitDate.getMinutes(), quitDate.getSeconds());
  const diff = nowUTC - quitUTC;
  const days = diff / (1000 * 60 * 60 * 24);
  
  // Health regeneration milestones (in days)
  const milestones = [
    { days: 0.014, progress: 2, name: 'Heart rate normalizes' },    // 20 minutes
    { days: 0.5, progress: 5, name: 'Blood pressure drops' },     // 12 hours
    { days: 1, progress: 8, name: 'Oxygen in blood rises' },       // 1 day
    { days: 7, progress: 15, name: 'Breathing easier' },      // 1 week
    { days: 14, progress: 25, name: 'Circulation improves' },     // 2 weeks
    { days: 30, progress: 40, name: 'Lung function improves' },    // 1 month
    { days: 60, progress: 55, name: 'Better lung function' },    // 2 months
    { days: 90, progress: 65, name: 'Sperm quality improves' },    // 3 months
    { days: 180, progress: 75, name: 'Depression risk decreases' },   // 6 months
    { days: 365, progress: 85, name: 'Heart disease risk drops' },   // 1 year
    { days: 730, progress: 92, name: 'Stroke risk drops' },   // 2 years
    { days: 1825, progress: 96, name: 'Chronic bronchitis risk drops' },  // 5 years
    { days: 3650, progress: 98, name: 'Lung cancer risk drops' },  // 10 years
    { days: 5475, progress: 100, name: 'Heart disease risk ≈ non-smoker' }   // 15 years
  ];
  
  // Handle case when quit date is in future or just happened
  if (diff <= 0 || days < 0) {
    return {
      percentage: 0,
      days: 0,
      nextMilestone: milestones[0],
      timeToNext: milestones[0].days * 24 * 60 * 60 * 1000
    };
  }
  
  let percentage = 0;
  let nextMilestone = null;
  let timeToNext = null;
  
  for (let i = 0; i < milestones.length; i++) {
    if (days >= milestones[i].days) {
      percentage = milestones[i].progress;
    } else {
      // Interpolate between milestones
      if (i > 0) {
        const prev = milestones[i - 1];
        const curr = milestones[i];
        const range = curr.days - prev.days;
        const progress = days - prev.days;
        const progressRatio = Math.min(1, progress / range);
        percentage = prev.progress + (curr.progress - prev.progress) * progressRatio;
      }
      
      // Find next milestone
      nextMilestone = milestones[i];
      const daysRemaining = nextMilestone.days - days;
      timeToNext = daysRemaining * 24 * 60 * 60 * 1000; // Convert to milliseconds
      break;
    }
  }
  
  // If all milestones reached, return null for next milestone
  if (!nextMilestone) {
    nextMilestone = null;
    timeToNext = null;
  }
  
  return {
    percentage: Math.min(100, Math.round(percentage)),
    days: Math.floor(days),
    nextMilestone: nextMilestone,
    timeToNext: timeToNext
  };
}

// Calculate individual health benefits progress
function calculateHealthBenefits(quitDate) {
  const now = new Date();
  // Use UTC to avoid timezone issues
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  const quitUTC = Date.UTC(quitDate.getFullYear(), quitDate.getMonth(), quitDate.getDate(), quitDate.getHours(), quitDate.getMinutes(), quitDate.getSeconds());
  const diff = nowUTC - quitUTC;
  const days = diff / (1000 * 60 * 60 * 24);
  
  // All health benefits for men organized by category
  const allBenefits = [
    // HEART BENEFITS
    { name: 'Heart Rate Normalizes', timeframe: '20 minutes', targetDays: 0.014, category: 'Heart', details: 'Your heart rate and blood pressure begin to drop immediately, reducing strain on your cardiovascular system.' },
    { name: 'Blood Pressure Drops', timeframe: '12 hours', targetDays: 0.5, category: 'Heart', details: 'Blood pressure starts to decrease, reducing the risk of hypertension and heart disease.' },
    { name: 'Oxygen in Blood Rises', timeframe: '1 day', targetDays: 1, category: 'Heart', details: 'Carbon monoxide levels drop, allowing more oxygen to reach your heart and muscles, improving overall cardiovascular health.' },
    { name: 'Heart Attack Risk Decreases', timeframe: '1 day', targetDays: 1, category: 'Heart', details: 'The risk of heart attack begins to decrease as your heart receives more oxygen and works more efficiently.' },
    { name: 'Circulation Improves', timeframe: '2 weeks', targetDays: 14, category: 'Heart', details: 'Blood circulation improves throughout your body, reducing the risk of blood clots and peripheral artery disease.' },
    { name: 'Reduced Blood Clots Risk', timeframe: '2 weeks', targetDays: 14, category: 'Heart', details: 'Your blood becomes less sticky, significantly reducing the risk of dangerous blood clots.' },
    { name: 'Arteries Less Inflamed', timeframe: '2 weeks', targetDays: 14, category: 'Heart', details: 'Inflammation in your arteries decreases, improving blood flow and reducing cardiovascular disease risk.' },
    { name: 'Coronary Heart Disease Risk ↓', timeframe: '1 year', targetDays: 365, category: 'Heart', details: 'Your risk of coronary heart disease drops significantly, approaching that of a non-smoker.' },
    { name: 'Stroke Risk Drops', timeframe: '2 years', targetDays: 730, category: 'Heart', details: 'The risk of stroke decreases substantially, improving long-term cardiovascular health.' },
    { name: 'Heart Disease Risk ≈ Non-Smoker', timeframe: '15 years', targetDays: 5475, category: 'Heart', details: 'Your heart disease risk returns to that of someone who never smoked, a major milestone for cardiovascular health.' },
    
    // LUNG BENEFITS
    { name: 'Breathing Easier', timeframe: '1 week', targetDays: 7, category: 'Lung', details: 'Your breathing becomes noticeably easier as lung function begins to improve and irritation decreases.' },
    { name: 'Less Coughing', timeframe: '2 weeks', targetDays: 14, category: 'Lung', details: 'Coughing and throat irritation decrease significantly as your respiratory system begins to heal.' },
    { name: 'Lung Cilia Start Repairing', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'Tiny hair-like structures in your lungs begin to repair, helping to clear mucus and protect against infections.' },
    { name: 'Shortness of Breath ↓', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'Shortness of breath decreases, making daily activities and exercise much more comfortable.' },
    { name: 'Mucus Production Decreases', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'Excessive mucus production reduces, leading to clearer airways and easier breathing.' },
    { name: 'Lung Function Improves', timeframe: '2 months', targetDays: 60, category: 'Lung', details: 'Lung capacity and function improve significantly, enhancing your ability to exercise and be active.' },
    { name: 'Fewer Respiratory Infections', timeframe: '2 months', targetDays: 60, category: 'Lung', details: 'Your immune system in the lungs strengthens, reducing the frequency of respiratory infections.' },
    { name: 'Asthma Flare-ups Decrease', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'If you have asthma, flare-ups become less frequent and less severe as lung inflammation decreases.' },
    { name: 'Oxygen Efficiency ↑ During Exercise', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'Your body becomes more efficient at using oxygen during physical activity, improving exercise performance.' },
    { name: 'COPD Progression Slows', timeframe: '1 month', targetDays: 30, category: 'Lung', details: 'If you have COPD, the progression of the disease slows significantly, preserving lung function.' },
    { name: 'Chronic Bronchitis Risk ↓', timeframe: '5 years', targetDays: 1825, category: 'Lung', details: 'Your risk of developing chronic bronchitis decreases substantially over time.' },
    { name: 'Lung Cancer Risk Starts Dropping', timeframe: '10 years', targetDays: 3650, category: 'Lung', details: 'Your risk of lung cancer begins to decrease significantly, a major health milestone.' },
    { name: 'Lung Cancer Risk Continues ↓', timeframe: '15 years', targetDays: 5475, category: 'Lung', details: 'Lung cancer risk continues to decrease, approaching levels closer to non-smokers.' },
    
    // BODY BENEFITS
    { name: 'Sense of Taste Improves', timeframe: '48 hours', targetDays: 2, category: 'Body', details: 'Your sense of taste begins to improve as taste buds recover from nicotine damage, making food more enjoyable.' },
    { name: 'Sense of Smell Improves', timeframe: '48 hours', targetDays: 2, category: 'Body', details: 'Your sense of smell starts to return as nasal passages clear and olfactory nerves recover, enhancing your ability to enjoy scents.' },
    { name: 'Body Odor Improves', timeframe: '1 week', targetDays: 7, category: 'Body', details: 'Body odor improves as you no longer smell like smoke, and your natural scent returns as toxins are eliminated from your body.' },
    { name: 'Energy Levels Increase', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Your energy levels rise as your body receives more oxygen and circulation improves.' },
    { name: 'Fatigue Decreases', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Chronic fatigue begins to fade as your body functions more efficiently without nicotine.' },
    { name: 'Better Wound Healing', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Wounds heal faster as circulation improves and your body receives more oxygen and nutrients.' },
    { name: 'Protein Synthesis Improves', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Protein synthesis and muscle repair improve as your body receives better oxygen and nutrient delivery, enhancing recovery and strength.' },
    { name: 'Stronger Immune Function', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Your immune system strengthens, making you more resistant to infections and illnesses.' },
    { name: 'Muscle Recovery Enhances', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Muscle recovery and protein utilization improve significantly, helping you build and maintain muscle mass more effectively.' },
    { name: 'Healthier Skin Tone', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Your skin tone improves as circulation increases, bringing more oxygen and nutrients to your skin.' },
    { name: 'Hair Health Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Hair health improves as circulation increases, reducing hair loss, improving hair quality, and slowing premature graying.' },
    { name: 'Voice Quality Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Your voice quality improves as throat irritation decreases, vocal cords heal, and the smoker\'s rasp diminishes.' },
    { name: 'Cholesterol Levels Improve', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Cholesterol levels begin to improve as your cardiovascular system heals, reducing the risk of heart disease.' },
    { name: 'Liver Function Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Liver function improves as the organ is no longer processing toxins from smoking, allowing it to function more efficiently.' },
    { name: 'Kidney Function Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Kidney function improves as blood flow increases and the organs are no longer filtering smoking toxins, reducing the risk of kidney disease.' },
    { name: 'Joint Health Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Joint health improves as inflammation decreases throughout your body, reducing pain and improving mobility.' },
    { name: 'Gum Inflammation Decreases', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Gum health improves as inflammation decreases, reducing the risk of gum disease.' },
    { name: 'Teeth Health Improves', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Teeth health improves as blood flow to gums increases, reducing plaque buildup and improving oral hygiene.' },
    { name: 'Teeth Whitening Begins', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Teeth begin to naturally whiten as staining from tobacco decreases and saliva production normalizes.' },
    { name: 'Stomach Acidity Normalizes', timeframe: '2 weeks', targetDays: 14, category: 'Body', details: 'Stomach acidity levels normalize, reducing acid reflux, heartburn, and GERD symptoms as nicotine withdrawal effects diminish.' },
    { name: 'Eye Health Improves', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Eye health improves as blood circulation increases, reducing the risk of age-related macular degeneration and improving vision.' },
    { name: 'DNA Damage Repair Begins', timeframe: '1 month', targetDays: 30, category: 'Body', details: 'Your body begins to repair DNA damage caused by smoking as cellular repair mechanisms improve with better oxygen and circulation.' },
    { name: 'DNA Repair Mechanisms Enhance', timeframe: '3 months', targetDays: 90, category: 'Body', details: 'DNA repair mechanisms significantly improve, reducing the risk of cancer and genetic mutations as your cells function more efficiently.' },
    { name: 'Metabolism Normalizes', timeframe: '3 months', targetDays: 90, category: 'Body', details: 'Your metabolism normalizes as your body adjusts to life without nicotine, helping with weight management and energy levels.' },
    { name: 'Sleep Apnea Improves', timeframe: '3 months', targetDays: 90, category: 'Body', details: 'Sleep apnea symptoms improve as breathing becomes easier and inflammation in airways decreases, leading to better sleep quality.' },
    { name: 'Sperm Count & Quality ↑', timeframe: '3 months', targetDays: 90, category: 'Body', details: 'Sperm count and quality improve significantly, enhancing fertility and reproductive health.' },
    { name: 'Fewer Wrinkles Over Time', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Skin aging slows down, leading to fewer wrinkles and a more youthful appearance.' },
    { name: 'Bone Density Loss Slows', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Bone density loss slows, reducing the risk of osteoporosis and fractures as you age.' },
    { name: 'Fracture Risk Decreases', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Your risk of bone fractures decreases as bone health improves.' },
    { name: 'Tooth Loss Risk Decreases', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'The risk of tooth loss decreases as oral health improves and gum disease risk drops.' },
    { name: 'Life Expectancy Increases', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Your life expectancy increases significantly as you reduce your risk of smoking-related diseases and improve overall health.' },
    { name: 'Overall Mortality Risk ↓', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Your overall risk of premature death decreases substantially, adding years to your life expectancy.' },
    { name: 'Premature Aging Slows', timeframe: '1 year', targetDays: 365, category: 'Body', details: 'Premature aging slows significantly as your body heals, leading to a more youthful appearance and better long-term health.' },
    { name: 'Type 2 Diabetes Risk ↓', timeframe: '2 years', targetDays: 730, category: 'Body', details: 'Your risk of developing type 2 diabetes decreases as insulin sensitivity improves.' },
    
    // SEX BENEFITS (VERY IMPORTANT)
    { name: 'Improved Libido', timeframe: '2 weeks', targetDays: 14, category: 'Sex', details: 'Sexual desire and libido improve as circulation increases and energy levels rise.' },
    { name: 'Erectile Function Improves', timeframe: '2 weeks', targetDays: 14, category: 'Sex', details: 'Erectile function improves significantly as blood flow to the penis increases and circulation improves.' },
    { name: 'Stronger Boner', timeframe: '1 month', targetDays: 30, category: 'Sex', details: 'Erections become significantly stronger and more reliable as vascular health improves, blood flow increases, and testosterone levels rise.' },
    { name: 'Better Blood Flow to Genitals', timeframe: '2 weeks', targetDays: 14, category: 'Sex', details: 'Blood circulation to the genitals improves, enhancing sexual performance and satisfaction.' },
    { name: 'Increased Testosterone Production', timeframe: '1 month', targetDays: 30, category: 'Sex', details: 'Testosterone production increases, boosting libido, energy, and overall sexual health.' },
    { name: 'Enhanced Sexual Stamina', timeframe: '1 month', targetDays: 30, category: 'Sex', details: 'Sexual stamina and endurance improve as cardiovascular health and lung function increase.' },
    { name: 'Improved Sperm Motility', timeframe: '3 months', targetDays: 90, category: 'Sex', details: 'Sperm motility improves, enhancing fertility and the chances of successful conception.' },
    { name: 'Reduced Erectile Dysfunction Risk', timeframe: '3 months', targetDays: 90, category: 'Sex', details: 'The risk of erectile dysfunction decreases as vascular health improves throughout your body.' },
    { name: 'Better Sexual Performance', timeframe: '3 months', targetDays: 90, category: 'Sex', details: 'Overall sexual performance improves with better circulation, energy, and cardiovascular health.' },
    { name: 'Increased Sexual Satisfaction', timeframe: '6 months', targetDays: 180, category: 'Sex', details: 'Sexual satisfaction increases as all aspects of sexual health continue to improve.' },
    { name: 'Libido Fully Recovered', timeframe: '1 year', targetDays: 365, category: 'Sex', details: 'Your libido is fully recovered and restored to optimal levels. Sexual desire, performance, and satisfaction reach peak levels as your body fully heals from smoking.' },
    { name: 'Long-term Impotence Risk ↓', timeframe: '2 years', targetDays: 730, category: 'Sex', details: 'The long-term risk of impotence decreases significantly, protecting your sexual health for years to come.' },
    
    // MIND BENEFITS
    { name: 'Anxiety About Health ↓', timeframe: 'Immediate', targetDays: 0, category: 'Mind', details: 'Anxiety about smoking-related health risks decreases immediately as you take control of your health.' },
    { name: 'Cravings Start to Decrease', timeframe: '1 week', targetDays: 7, category: 'Mind', details: 'Nicotine cravings begin to decrease in intensity and frequency as your body adjusts.' },
    { name: 'Sleep Quality Improves', timeframe: '1 week', targetDays: 7, category: 'Mind', details: 'Sleep quality improves as nicotine withdrawal symptoms decrease and breathing becomes easier.' },
    { name: 'Confidence in Quitting ↑', timeframe: '1 week', targetDays: 7, category: 'Mind', details: 'Your confidence in your ability to quit increases as you successfully navigate the first week.' },
    { name: 'Improved Concentration', timeframe: '2 weeks', targetDays: 14, category: 'Mind', details: 'Mental clarity and concentration improve as your brain receives more oxygen and functions better.' },
    { name: 'Mood Stabilization', timeframe: '2 weeks', targetDays: 14, category: 'Mind', details: 'Your mood becomes more stable as nicotine withdrawal effects diminish and brain chemistry normalizes.' },
    { name: 'Reduced Stress from Nicotine', timeframe: '2 weeks', targetDays: 14, category: 'Mind', details: 'Stress related to nicotine dependence decreases as you break free from the addiction cycle.' },
    { name: 'Mental Clarity Improves', timeframe: '2 weeks', targetDays: 14, category: 'Mind', details: 'Mental clarity and cognitive function improve as your brain receives better blood flow and oxygen.' },
    { name: 'Depression Risk Decreases', timeframe: '6 months', targetDays: 180, category: 'Mind', details: 'The risk of depression decreases as overall health improves and you gain confidence in your new lifestyle.' },
    { name: 'Cognitive Function Protects', timeframe: '10 years', targetDays: 3650, category: 'Mind', details: 'Long-term cognitive function is protected, reducing the risk of age-related mental decline.' }
  ];
  
  if (diff <= 0 || days < 0) {
    // Sort by time even when showing zeros
    const sortedBenefits = [...allBenefits].sort((a, b) => a.targetDays - b.targetDays);
    return sortedBenefits.map(benefit => ({
      name: benefit.name,
      progress: 0,
      timeframe: benefit.timeframe,
      details: benefit.details,
      category: benefit.category
    }));
  }
  
  const benefits = allBenefits.map(benefit => ({
    name: benefit.name,
    timeframe: benefit.timeframe,
    targetDays: benefit.targetDays,
    progress: Math.min(100, Math.round((days / benefit.targetDays) * 100)),
    details: benefit.details,
    category: benefit.category
  }));
  
  // Sort by time (targetDays) - earliest first
  benefits.sort((a, b) => a.targetDays - b.targetDays);
  
  return benefits.map(benefit => ({
    name: benefit.name,
    progress: benefit.progress,
    timeframe: benefit.timeframe,
    details: benefit.details,
    category: benefit.category
  }));
}

// Render the tracker
function renderTracker() {
  // Clear any existing timer before re-rendering
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Clear tip rotation interval
  if (tipInterval) {
    clearInterval(tipInterval);
    tipInterval = null;
  }
  
  const quitDate = getQuitDate();
  
  if (!quitDate) {
    // Show setup form
    document.querySelector('#app').innerHTML = `
      <div class="home-container">
        <h1 class="main-title">Quit Now</h1>
        <div class="setup-form">
          <h2>When did you quit smoking?</h2>
          <div class="form-group">
            <label for="nickname">Nickname:</label>
            <input type="text" id="nickname" placeholder="Your name" maxlength="20">
          </div>
          <div class="form-group">
            <label for="quitDate">Quit Date:</label>
            <input type="datetime-local" id="quitDate" required>
            <small class="form-hint">Format: dd-mm-yyyy --:--</small>
          </div>
          <div class="form-group">
            <label for="cigarettesPerDay">Cigarettes per day:</label>
            <input type="number" id="cigarettesPerDay" value="${DEFAULT_CIGARETTES_PER_DAY}" min="1" required>
          </div>
          <div class="form-group">
            <label for="costPerPack">Cost per pack ($):</label>
            <input type="number" id="costPerPack" value="${DEFAULT_COST_PER_PACK}" min="0" step="0.01" required>
          </div>
          <button class="btn-primary" id="startTrackingBtn" aria-label="Start tracking your quit smoking progress">Start Tracking</button>
        </div>
      </div>
    `;
    
    // Attach event listener to start tracking button
    const startBtn = document.getElementById('startTrackingBtn');
    if (startBtn) {
      startBtn.addEventListener('click', startTracking);
    }
  } else {
    // Show tracker
    const nickname = getNickname();
    const timeElapsed = calculateTimeElapsed(quitDate);
    const stats = calculateStats(quitDate);
    const health = calculateHealthRegeneration(quitDate);
    const healthBenefits = calculateHealthBenefits(quitDate);
    
    // Format date with error handling (Dec, 24, 2025 01:02 PM)
    let quitDateStr;
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = quitDate.getDate();
      const month = monthNames[quitDate.getMonth()];
      const year = quitDate.getFullYear();
      let hours = quitDate.getHours();
      const minutes = String(quitDate.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const hoursStr = String(hours).padStart(2, '0');
      quitDateStr = `${month}, ${day}, ${year} ${hoursStr}:${minutes} ${ampm}`;
    } catch (error) {
      // Fallback if date formatting fails
      quitDateStr = quitDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

// Escape HTML to prevent XSS
const safeNickname = nickname ? escapeHtml(nickname) : '';
const safeQuitDateStr = escapeHtml(quitDateStr);

document.querySelector('#app').innerHTML = `
      <div class="home-container">
        <h1 class="main-title" id="mainTitle">${safeNickname ? `Hey ${safeNickname}!` : 'Quit Now'}</h1>
        <p class="rotating-tip" id="rotatingTip">${escapeHtml(MOTIVATIONAL_TIPS[0])}</p>
        <div class="quit-date-info">
          <p class="since-label">Since</p>
          <div class="quit-date-container">
            <p class="quit-date">${safeQuitDateStr}</p>
                <button class="edit-icon" id="resetBtn" aria-label="Reset tracker" title="Reset tracker">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="time-display">
          <div class="time-unit">
            <div class="time-value" id="days">${timeElapsed.days}</div>
            <div class="time-label">Days</div>
          </div>
          <div class="time-unit">
            <div class="time-value" id="hours">${String(timeElapsed.hours).padStart(2, '0')}</div>
            <div class="time-label">Hours</div>
          </div>
          <div class="time-unit">
            <div class="time-value" id="minutes">${String(timeElapsed.minutes).padStart(2, '0')}</div>
            <div class="time-label">Minutes</div>
          </div>
          <div class="time-unit">
            <div class="time-value" id="seconds">${String(timeElapsed.seconds).padStart(2, '0')}</div>
            <div class="time-label">Seconds</div>
          </div>
        </div>
        
        <div class="health-regeneration-section">
          ${health.nextMilestone ? `
            <div class="next-regeneration">
              <div class="next-regeneration-label">Next Regeneration:</div>
              <div class="next-regeneration-name">${escapeHtml(health.nextMilestone.name)}</div>
              <div class="next-regeneration-time" id="nextRegenerationTime">At ...</div>
            </div>
          ` : `
            <div class="next-regeneration">
              <div class="next-regeneration-label">🎉 All Milestones Achieved!</div>
            </div>
          `}
          <div class="health-header">
            <div class="health-label">Health</div>
            <div class="health-percentage" id="healthPercentage">${health.percentage}%</div>
          </div>
          <div class="health-progress-bar">
            <div class="health-progress-fill" id="healthProgressFill" style="width: ${health.percentage}%"></div>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value" id="cigarettesAvoided">${stats.cigarettesAvoided.toLocaleString()}</div>
            <div class="stat-label">Cigarettes Avoided</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="moneySaved">$${stats.moneySaved}</div>
            <div class="stat-label">Money Saved</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="daysQuit">${stats.daysQuit}</div>
            <div class="stat-label">Days Quit</div>
          </div>
        </div>
        
        <div class="health-benefits-section">
          <h3 class="benefits-title">Health Benefits</h3>
          <div class="benefits-grid">
            ${healthBenefits.map((benefit, index) => `
              <div class="benefit-card" data-benefit-index="${index}" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(benefit.name)} - ${escapeHtml(benefit.timeframe)}">
                <div class="benefit-main">
                  <div class="benefit-header">
                    <div class="benefit-name">${escapeHtml(benefit.name)}</div>
                    <div class="benefit-percentage" id="benefitPercentage${index}">${benefit.progress}%</div>
                  </div>
                  <div class="benefit-timeframe">${escapeHtml(benefit.timeframe)}</div>
                  <div class="benefit-progress-bar">
                    <div class="benefit-progress-fill" id="benefitProgressFill${index}" style="width: ${benefit.progress}%"></div>
                  </div>
                </div>
                <div class="benefit-details" id="benefitDetails${index}">
                  <div class="benefit-details-content">${escapeHtml(benefit.details)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="footer-section">
          <div class="footer-content">
            <p class="footer-thankyou">Thank you for choosing to quit smoking.</p>
            <p class="footer-supported">Supported by WHO and health organizations worldwide.</p>
            <p class="footer-note">Based on scientific research. Consult your healthcare provider for personalized advice.</p>
          </div>
    </div>
  </div>
    `;
    
    // Start updating timer
    startTimer();
    
    // Start rotating tips
    startTipRotation();
    
    // Attach event listeners (replacing onclick handlers)
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetTracker);
      resetBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resetTracker();
        }
      });
    }
    
    // Attach event listeners to benefit cards
    const benefitCards = document.querySelectorAll('.benefit-card');
    benefitCards.forEach((card) => {
      const index = parseInt(card.getAttribute('data-benefit-index'));
      card.addEventListener('click', () => toggleBenefitDetails(index));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleBenefitDetails(index);
        }
      });
    });
  }
}

// Timer interval reference for cleanup
let timerInterval = null;
let lastHealthUpdate = 0;
let cachedHealthBenefits = null;
let cachedHealth = null;

// Start the timer
function startTimer() {
  const quitDate = getQuitDate();
  if (!quitDate) return;
  
  // Clear any existing interval to prevent memory leaks
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Cache DOM elements for better performance
  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const cigarettesEl = document.getElementById('cigarettesAvoided');
  const moneyEl = document.getElementById('moneySaved');
  const daysQuitEl = document.getElementById('daysQuit');
  const healthPercentageEl = document.getElementById('healthPercentage');
  const healthProgressFillEl = document.getElementById('healthProgressFill');
  const nextRegenerationTimeEl = document.getElementById('nextRegenerationTime');
  
  function update() {
    try {
      const now = new Date();
      const timeElapsed = calculateTimeElapsed(quitDate);
      const stats = calculateStats(quitDate);
      
      // Update timer (always needed)
      if (daysEl) daysEl.textContent = timeElapsed.days;
      if (hoursEl) hoursEl.textContent = String(timeElapsed.hours).padStart(2, '0');
      if (minutesEl) minutesEl.textContent = String(timeElapsed.minutes).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(timeElapsed.seconds).padStart(2, '0');
      
      // Update stats (only if changed)
      if (cigarettesEl) {
        const newCigarettes = stats.cigarettesAvoided.toLocaleString();
        if (cigarettesEl.textContent !== newCigarettes) {
          cigarettesEl.textContent = newCigarettes;
        }
      }
      if (moneyEl) {
        const newMoney = `$${stats.moneySaved}`;
        if (moneyEl.textContent !== newMoney) {
          moneyEl.textContent = newMoney;
        }
      }
      if (daysQuitEl) {
        const newDays = stats.daysQuit.toString();
        if (daysQuitEl.textContent !== newDays) {
          daysQuitEl.textContent = newDays;
        }
      }
      
      // Update health regeneration (only every 5 seconds for performance)
      const timeSinceLastHealthUpdate = now.getTime() - lastHealthUpdate;
      if (timeSinceLastHealthUpdate >= 5000 || lastHealthUpdate === 0) {
        lastHealthUpdate = now.getTime();
        
        const health = calculateHealthRegeneration(quitDate);
        cachedHealth = health;
        
        if (healthPercentageEl) {
          healthPercentageEl.textContent = `${health.percentage}%`;
        }
        if (healthProgressFillEl) {
          healthProgressFillEl.style.width = `${health.percentage}%`;
        }
        
        // Update next regeneration time
        if (nextRegenerationTimeEl && health.nextMilestone && health.timeToNext) {
          const milestoneDate = new Date(now.getTime() + health.timeToNext);
          
          try {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = milestoneDate.getDate();
            const month = monthNames[milestoneDate.getMonth()];
            const year = milestoneDate.getFullYear();
            let hours = milestoneDate.getHours();
            const minutes = String(milestoneDate.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const hoursStr = String(hours).padStart(2, '0');
            const dateStr = `${month}, ${day}, ${year} ${hoursStr}:${minutes} ${ampm}`;
            
            nextRegenerationTimeEl.textContent = `At ${dateStr}`;
          } catch (error) {
            nextRegenerationTimeEl.textContent = `At ${milestoneDate.toLocaleString()}`;
          }
        }
        
        // Update health benefits (only every 5 seconds - they don't change every second)
        const healthBenefits = calculateHealthBenefits(quitDate);
        cachedHealthBenefits = healthBenefits;
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          healthBenefits.forEach((benefit, index) => {
            const percentageEl = document.getElementById(`benefitPercentage${index}`);
            const progressFillEl = document.getElementById(`benefitProgressFill${index}`);
            if (percentageEl) {
              const newProgress = `${benefit.progress}%`;
              if (percentageEl.textContent !== newProgress) {
                percentageEl.textContent = newProgress;
              }
            }
            if (progressFillEl) {
              const newWidth = `${benefit.progress}%`;
              if (progressFillEl.style.width !== newWidth) {
                progressFillEl.style.width = newWidth;
              }
            }
          });
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating timer:', error);
      }
    }
  }
  
  update();
  timerInterval = setInterval(update, 1000);
}

// Start rotating motivational tips
function startTipRotation() {
  const nickname = getNickname();
  const tipEl = document.getElementById('rotatingTip');
  const titleEl = document.getElementById('mainTitle');
  
  if (!tipEl) return;
  
  // Clear any existing interval
  if (tipInterval) {
    clearInterval(tipInterval);
    tipInterval = null;
  }
  
  // Update tip every 10 seconds with fade animation
  tipInterval = setInterval(() => {
    if (tipEl) {
      // Fade out
      tipEl.style.opacity = '0';
      tipEl.style.transform = 'translateY(-5px)';
      
      setTimeout(() => {
        currentTipIndex = (currentTipIndex + 1) % MOTIVATIONAL_TIPS.length;
        tipEl.textContent = MOTIVATIONAL_TIPS[currentTipIndex];
        
        // Fade in
        tipEl.style.opacity = '1';
        tipEl.style.transform = 'translateY(0)';
      }, 300);
    }
  }, 10000);
  
  // Also update title to show "Hey [nickname]!" format
  if (titleEl && nickname) {
    titleEl.textContent = `Hey ${nickname}!`;
  }
}

// Start tracking function (called from button)
window.startTracking = function() {
  try {
    const nicknameEl = document.getElementById('nickname');
    const dateInputEl = document.getElementById('quitDate');
    const cigarettesPerDayEl = document.getElementById('cigarettesPerDay');
    const costPerPackEl = document.getElementById('costPerPack');
    
    if (!dateInputEl || !cigarettesPerDayEl || !costPerPackEl) {
      showErrorModal('Form elements not found. Please refresh the page.');
      return;
    }
    
    // Save nickname
    if (nicknameEl) {
      setNickname(nicknameEl.value);
    }
    
    const dateInput = dateInputEl.value;
    if (!dateInput) {
      showErrorModal('Please select a quit date');
      return;
    }
    
    const quitDate = new Date(dateInput);
    if (isNaN(quitDate.getTime())) {
      showErrorModal('Invalid date selected. Please choose a valid date.');
      return;
    }
    
    // Check if date is too far in the future
    const now = new Date();
    if (quitDate > now) {
      showErrorModal('Quit date cannot be in the future. Please select a past or current date.');
      return;
    }
    
    // Check if date is too old (more than 50 years ago)
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 50);
    if (quitDate < minDate) {
      showErrorModal('Quit date cannot be more than 50 years ago. Please select a more recent date.');
      return;
    }
    
    setQuitDate(quitDate);
    
    // Store preferences with error handling
    const cigarettesPerDay = parseInt(cigarettesPerDayEl.value) || DEFAULT_CIGARETTES_PER_DAY;
    const costPerPack = parseFloat(costPerPackEl.value) || DEFAULT_COST_PER_PACK;
    
    if (cigarettesPerDay < 1 || cigarettesPerDay > 200) {
      showErrorModal('Please enter a valid number of cigarettes per day (1-200).');
      return;
    }
    
    if (costPerPack < 0 || costPerPack > 1000) {
      showErrorModal('Please enter a valid cost per pack (0-1000).');
      return;
    }
    
    try {
      localStorage.setItem('cigarettesPerDay', cigarettesPerDay);
      localStorage.setItem('costPerPack', costPerPack);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        showErrorModal('Storage is full. Please clear some data or use a different browser.');
      } else {
        showErrorModal('Unable to save preferences. Please check if localStorage is enabled.');
      }
      return;
    }
    
    // Clear timer before re-rendering
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    renderTracker();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error starting tracking:', error);
    }
    showErrorModal('An error occurred. Please try again.');
  }
};

// Show error modal
function showErrorModal(message) {
  const existingModal = document.querySelector('.error-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  if (!document.body) return;
  
  const modal = document.createElement('div');
  modal.className = 'error-modal-overlay';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'error-modal-title');
  modal.innerHTML = `
    <div class="error-modal">
      <h3 id="error-modal-title">Error</h3>
      <p>${escapeHtml(message)}</p>
      <div class="error-modal-buttons">
        <button class="btn-confirm" type="button">OK</button>
      </div>
    </div>
  `;
  
  // Prevent body scroll when modal is open
  const originalOverflow = document.body.style.overflow;
  const originalPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  document.body.style.overflow = 'hidden';
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.zIndex = '10000';
  
  // Store original styles for cleanup
  modal._originalOverflow = originalOverflow;
  modal._originalPaddingRight = originalPaddingRight;
  
  const closeErrorModal = () => {
    modal.classList.add('closing');
    document.body.style.overflow = modal._originalOverflow || '';
    document.body.style.paddingRight = modal._originalPaddingRight || '';
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 200);
  };
  
  const okBtn = modal.querySelector('.btn-confirm');
  if (okBtn) {
    okBtn.addEventListener('click', closeErrorModal);
    okBtn.focus();
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeErrorModal();
    }
  });
  
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeErrorModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
  modal._escapeHandler = escapeHandler;
}

// Show custom confirmation modal
function showResetConfirmation() {
  // Remove any existing modal first
  const existingModal = document.querySelector('.reset-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Ensure body exists and is ready
  if (!document.body) {
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'reset-modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'reset-modal-title');
  modal.innerHTML = `
    <div class="reset-modal">
      <h3 id="reset-modal-title">Reset Tracker?</h3>
      <p>This will delete your quit date and reset all progress. Your nickname will be kept.</p>
      <div class="reset-modal-buttons">
        <button class="btn-cancel" type="button">Cancel</button>
        <button class="btn-confirm" type="button">Reset</button>
      </div>
    </div>
  `;
  
  // Prevent body scroll when modal is open
  const originalOverflow = document.body.style.overflow;
  const originalPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  document.body.style.overflow = 'hidden';
  
  // Append to body
  document.body.appendChild(modal);
  
  // Force display (in case CSS isn't loaded)
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.zIndex = '10000';
  
  // Store original styles for cleanup
  modal._originalOverflow = originalOverflow;
  modal._originalPaddingRight = originalPaddingRight;
  
  // Add event listeners to buttons
  const cancelBtn = modal.querySelector('.btn-cancel');
  const confirmBtn = modal.querySelector('.btn-confirm');
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeResetModal();
    });
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmReset();
    });
  }
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeResetModal();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeResetModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Store handler for cleanup
  modal._escapeHandler = escapeHandler;
  
  // Focus the cancel button for accessibility
  if (cancelBtn) {
    setTimeout(() => cancelBtn.focus(), 100);
  }
}

// Close reset modal
window.closeResetModal = function() {
  const modal = document.querySelector('.reset-modal-overlay');
  if (modal) {
    // Remove escape handler
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }
    
    // Add closing class for smooth fade-out
    modal.classList.add('closing');
    
    // Restore body scroll
    document.body.style.overflow = modal._originalOverflow || '';
    document.body.style.paddingRight = modal._originalPaddingRight || '';
    
    // Remove modal after animation completes
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 200); // Match animation duration
  }
};

// Confirm reset
window.confirmReset = function() {
  const modal = document.querySelector('.reset-modal-overlay');
  
  // Close modal with animation
  if (modal) {
    // Remove escape handler
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }
    
    // Add closing class for smooth fade-out
    modal.classList.add('closing');
    
    // Restore body scroll
    document.body.style.overflow = modal._originalOverflow || '';
    document.body.style.paddingRight = modal._originalPaddingRight || '';
    
    // Remove modal after animation completes, then reset
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
      
      // Reset tracker after modal animation completes
      try {
        // Clear timer
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        
        // Clear tip rotation
        if (tipInterval) {
          clearInterval(tipInterval);
          tipInterval = null;
        }
        
        localStorage.removeItem('quitDate');
        localStorage.removeItem('cigarettesPerDay');
        localStorage.removeItem('costPerPack');
        // Note: nickname is kept on reset
        
        // Small delay before re-rendering to prevent jump
        requestAnimationFrame(() => {
          renderTracker();
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error resetting tracker:', error);
        }
        showErrorModal('Unable to reset tracker. Please try again.');
      }
    }, 200); // Match animation duration
  }
};

// Reset tracker function
window.resetTracker = function() {
  showResetConfirmation();
};

// Toggle benefit details
window.toggleBenefitDetails = function(index) {
  const detailsEl = document.getElementById(`benefitDetails${index}`);
  const cardEl = detailsEl?.closest('.benefit-card');
  
  if (detailsEl && cardEl) {
    const isOpen = cardEl.classList.contains('benefit-card-open');
    
    // Close all other open cards
    document.querySelectorAll('.benefit-card-open').forEach(card => {
      if (card !== cardEl) {
        card.classList.remove('benefit-card-open');
        card.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Toggle current card
    const willBeOpen = !isOpen;
    cardEl.classList.toggle('benefit-card-open', willBeOpen);
    cardEl.setAttribute('aria-expanded', willBeOpen.toString());
  }
};

// Pause timer when page is hidden to save battery
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause timer when page is hidden
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  } else {
    // Resume timer when page becomes visible
    if (getQuitDate()) {
      startTimer();
    }
  }
});

// Initialize
renderTracker();
