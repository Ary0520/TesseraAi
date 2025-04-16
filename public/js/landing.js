// NEXUS AI - Premium Landing Page JavaScript

// Initialize particles.js
document.addEventListener('DOMContentLoaded', function() {
  // Initialize GSAP ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Particles.js configuration
  particlesJS('particles-js', {
    particles: {
      number: {
        value: 80,
        density: {
          enable: true,
          value_area: 800
        }
      },
      color: {
        value: ['#00b0ff', '#7b68ee', '#00e5ff']
      },
      shape: {
        type: 'circle',
        stroke: {
          width: 0,
          color: '#000000'
        }
      },
      opacity: {
        value: 0.5,
        random: true,
        anim: {
          enable: true,
          speed: 1,
          opacity_min: 0.1,
          sync: false
        }
      },
      size: {
        value: 3,
        random: true,
        anim: {
          enable: true,
          speed: 2,
          size_min: 0.1,
          sync: false
        }
      },
      line_linked: {
        enable: true,
        distance: 150,
        color: '#00b0ff',
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 1,
        direction: 'none',
        random: true,
        straight: false,
        out_mode: 'out',
        bounce: false,
        attract: {
          enable: true,
          rotateX: 600,
          rotateY: 1200
        }
      }
    },
    interactivity: {
      detect_on: 'canvas',
      events: {
        onhover: {
          enable: true,
          mode: 'grab'
        },
        onclick: {
          enable: true,
          mode: 'push'
        },
        resize: true
      },
      modes: {
        grab: {
          distance: 140,
          line_linked: {
            opacity: 1
          }
        },
        push: {
          particles_nb: 4
        }
      }
    },
    retina_detect: true
  });

  // Initialize progress rings
  initProgressRings();

  // We're using GSAP for all animations now
  // initScrollAnimations(); // Removed to prevent conflicts

  // Initialize GSAP animations
  initGSAPAnimations();

  // Initialize loading animation
  initLoadingAnimation();

  // Initialize Enter button
  document.getElementById('enter-btn').addEventListener('click', function() {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.visibility = 'visible';
    loadingOverlay.style.opacity = '1';

    // Simulate loading progress
    simulateLoading().then(() => {
      // Redirect to main app
      window.location.href = 'index.html';
    });
  });
});

// Initialize progress rings
function initProgressRings() {
  const rings = document.querySelectorAll('.progress-ring-circle');

  rings.forEach(ring => {
    const parent = ring.closest('.capability-item');
    const progressText = parent.querySelector('.progress-text');
    const progress = parseInt(progressText.textContent);

    // Set the progress as a CSS variable
    ring.style.setProperty('--progress', progress);

    // Animate the progress when in viewport
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          ring.style.strokeDashoffset = `calc(326.56 - (326.56 * ${progress}) / 100)`;
          observer.unobserve(entry.target);

          // Animate the text counter
          let currentProgress = 0;
          const interval = setInterval(() => {
            if (currentProgress >= progress) {
              clearInterval(interval);
            } else {
              currentProgress++;
              progressText.textContent = `${currentProgress}%`;
            }
          }, 20);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(parent);
  });
}

// Initialize scroll animations - Disabled to use GSAP instead
// function initScrollAnimations() {
//   // Elements to animate on scroll
//   const elements = [
//     ...document.querySelectorAll('.feature-card'),
//     ...document.querySelectorAll('.capability-item'),
//     ...document.querySelectorAll('.about-content p')
//   ];
//
//   const observer = new IntersectionObserver((entries) => {
//     entries.forEach(entry => {
//       if (entry.isIntersecting) {
//         entry.target.style.opacity = '1';
//         entry.target.style.transform = 'translateY(0)';
//         observer.unobserve(entry.target);
//       }
//     });
//   }, { threshold: 0.1 });
//
//   elements.forEach((el, index) => {
//     // Set initial styles
//     el.style.opacity = '0';
//     el.style.transform = 'translateY(30px)';
//     el.style.transition = `opacity 0.5s ease, transform 0.5s ease ${index * 0.1}s`;
//
//     // Observe element
//     observer.observe(el);
//   });
// }

// Simulate loading progress
function simulateLoading() {
  return new Promise(resolve => {
    const progressBar = document.querySelector('.loading-progress');
    const progressText = document.querySelector('.loading-percentage');
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 10;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // Wait a bit before resolving
        setTimeout(resolve, 500);
      }

      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
    }, 200);
  });
}

// Initialize loading animation
function initLoadingAnimation() {
  const loadingOverlay = document.getElementById('loading-overlay');

  // Make sure loading overlay is hidden by default
  loadingOverlay.style.opacity = '0';
  loadingOverlay.style.visibility = 'hidden';

  // Only show loading overlay when clicking the Enter button
  // The initial page load doesn't need to show the loading overlay
}

// Parallax effect for orb
document.addEventListener('mousemove', function(e) {
  const orb = document.querySelector('.orb');
  const xAxis = (window.innerWidth / 2 - e.pageX) / 50;
  const yAxis = (window.innerHeight / 2 - e.pageY) / 50;

  orb.style.transform = `translate(${xAxis}px, ${yAxis}px)`;
});

// Initialize GSAP animations
function initGSAPAnimations() {
  // Make sure all animated elements are visible by default
  gsap.set('.feature-card, .capability-item, .testimonial-card, .about-content p', {
    opacity: 1,
    clearProps: 'transform'
  });
  // Hero section animations
  gsap.from('.hero-content h1', {
    duration: 1.5,
    opacity: 0,
    y: 50,
    ease: 'power3.out'
  });

  gsap.from('.hero-content .tagline', {
    duration: 1.5,
    opacity: 0,
    y: 30,
    delay: 0.3,
    ease: 'power3.out'
  });

  gsap.from('.hero-features .feature', {
    duration: 1,
    opacity: 0,
    y: 20,
    stagger: 0.2,
    delay: 0.6,
    ease: 'power3.out'
  });

  gsap.from('.cta-button', {
    duration: 1,
    opacity: 0,
    y: 20,
    delay: 1.2,
    ease: 'power3.out'
  });

  gsap.from('.ai-brain', {
    duration: 1.5,
    opacity: 0,
    scale: 0.8,
    delay: 0.5,
    ease: 'power3.out'
  });

  // Scroll animations for sections
  gsap.from('.features-section .section-title', {
    scrollTrigger: {
      trigger: '.features-section',
      start: 'top 80%'
    },
    duration: 1,
    opacity: 0,
    y: 30,
    ease: 'power3.out'
  });

  gsap.from('.capabilities-section .section-title', {
    scrollTrigger: {
      trigger: '.capabilities-section',
      start: 'top 80%'
    },
    duration: 1,
    opacity: 0,
    y: 30,
    ease: 'power3.out'
  });

  gsap.from('.about-section .section-title', {
    scrollTrigger: {
      trigger: '.about-section',
      start: 'top 80%'
    },
    duration: 1,
    opacity: 0,
    y: 30,
    ease: 'power3.out'
  });

  gsap.from('.testimonials-section .section-title', {
    scrollTrigger: {
      trigger: '.testimonials-section',
      start: 'top 80%'
    },
    duration: 1,
    opacity: 0,
    y: 30,
    ease: 'power3.out'
  });

  // Testimonial cards animation
  gsap.from('.testimonial-card', {
    scrollTrigger: {
      trigger: '.testimonial-slider',
      start: 'top 80%'
    },
    duration: 1,
    opacity: 0,
    y: 50,
    stagger: 0.2,
    ease: 'power3.out'
  });

  // Feature cards staggered animation
  gsap.from('.feature-card', {
    scrollTrigger: {
      trigger: '.features-grid',
      start: 'top 80%'
    },
    duration: 0.8,
    opacity: 0,
    y: 50,
    stagger: 0.1,
    ease: 'power3.out'
  });

  // Capability items staggered animation
  gsap.from('.capability-item', {
    scrollTrigger: {
      trigger: '.capabilities-container',
      start: 'top 80%'
    },
    duration: 0.8,
    opacity: 0,
    y: 30,
    stagger: 0.15,
    ease: 'power3.out'
  });
}

// 3D tilt effect for feature cards - Initialize after page load
function initTiltEffect() {
  document.querySelectorAll('.feature-card').forEach(card => {
    // Make sure cards are visible first
    card.style.opacity = '1';

    card.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xPercent = x / rect.width;
      const yPercent = y / rect.height;

      const xRotation = (yPercent - 0.5) * 10;
      const yRotation = (0.5 - xPercent) * 10;

      this.style.transform = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg) translateY(-10px)`;
      this.style.transition = 'transform 0.1s ease';
    });

    card.addEventListener('mouseleave', function() {
      this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
      this.style.transition = 'transform 0.5s ease';
    });
  });
}

// Initialize tilt effect after page load
window.addEventListener('load', function() {
  // Wait for GSAP animations to complete
  setTimeout(initTiltEffect, 1500);
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();

    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  });
});
