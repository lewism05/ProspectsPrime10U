/* ==========================================================================
   PROSPECTS 10U — DRILL LIBRARY
   Age-appropriate drills indexed by the weakness they fix.
   Sourced from USA Baseball / Little League University, Driveline, The
   Hitting Vault, ABCA Coaches' Corner, MOJO Sports and common travel-ball
   practice plans, adapted for 10U attention spans and skill level.

   audience: 'coach'  = needs a full practice setup
             'parent' = doable in a backyard or driveway
             'player' = the kid can run it alone
   ========================================================================== */
window.P10 = window.P10 || {};

P10.DRILLS = {

  /* ================= BATTING ================= */

  high_k_rate: [
    {
      title: 'Two-Strike Approach',
      cue: 'Choke up · Crowd the plate · Shorten up',
      steps: [
        'With two strikes, choke up one to two inches on the bat.',
        'Move two to three inches closer to the plate to cover the outside corner.',
        'Widen the stance an inch for balance and cut the stride down to a toe-tap.',
        'New goal: foul off anything close, put any strike in play. No chasing.'
      ],
      time: '10 min', gear: 'Tee or live BP', audience: 'player'
    },
    {
      title: 'Color Call Toss',
      cue: 'Track it, decide late',
      steps: [
        'Coach holds two different-colored balls, one in each hand.',
        'Soft toss BOTH at the same time and shout one color in the air.',
        'Hitter swings only at the called color and lets the other one go.',
        'Forces true tracking and a late decision. This is the fix for chasing.'
      ],
      time: '8 min', gear: 'Two colored balls, screen', audience: 'parent'
    },
    {
      title: 'Knob Drill',
      cue: 'Hands inside the ball',
      steps: [
        'Set a ball on the tee at belt height.',
        'Hitter takes a normal stance but tries to hit the ball with the KNOB of the bat.',
        'It feels strange - that is the point. It forces the hands tight to the body.',
        'Builds a short, direct path. Kills the long looping swing that misses.'
      ],
      time: '5 min', gear: 'Tee, bat', audience: 'parent'
    },
    {
      title: 'Load-and-Freeze',
      cue: 'Be on time, every time',
      steps: [
        'Coach goes through the pitching motion but does not release.',
        'Hitter loads on the leg lift and FREEZES at foot-strike. Coach checks the position.',
        'Hands back, weight balanced, front foot down, eyes level.',
        'Most 10U strikeouts are timing, not bat speed. This fixes timing.'
      ],
      time: '8 min', gear: 'None', audience: 'coach'
    }
  ],

  low_obp: [
    {
      title: 'Take-Pitch Points Game',
      cue: 'Reward not swinging',
      steps: [
        'Coach intentionally throws every third pitch out of the zone.',
        'Hitter takes the bad pitch = +1 point. Swings at it = -1.',
        'Swings at a strike and makes contact = +1. Takes a strike = -1.',
        'Play to 10. Walks come from believing the zone is real.'
      ],
      time: '12 min', gear: 'Coach pitch, screen', audience: 'coach'
    },
    {
      title: 'Strike Zone Box',
      cue: 'Yes-zone vs no-zone',
      steps: [
        'Tape a strike zone outline on a fence or net.',
        'Hitter stands in the box with NO bat and just calls "ball" or "strike" on every toss.',
        'Pure visual training. Twenty pitches, coach corrects every miss.',
        'Then hand the bat back - swing only at the ones they called strike.'
      ],
      time: '10 min', gear: 'Tape, screen, balls', audience: 'parent'
    },
    {
      title: 'First-Pitch Decision',
      cue: 'Get a good one to hit',
      steps: [
        'Hitter gets one pitch per at-bat, then rotates out.',
        'Only score it a win if they swung at a strike or took a ball.',
        'Track the number over a practice and post it.',
        'Teaches that the at-bat is won before the swing.'
      ],
      time: '10 min', gear: 'Coach pitch', audience: 'coach'
    }
  ],

  low_slg: [
    {
      title: 'Hammer Time',
      cue: 'The hands drive the barrel',
      steps: [
        'Ball on the tee at belt height.',
        'Hitter swings a rubber mallet or hammer instead of a bat and "hits" the ball with the head.',
        'The hand path that squares a hammer is the same one that squares a barrel.',
        'Ten reps with the hammer, then ten with the bat. The difference is immediate.'
      ],
      time: '6 min', gear: 'Rubber mallet, tee', audience: 'parent'
    },
    {
      title: 'Happy Gilmore',
      cue: 'Momentum into the swing',
      steps: [
        'Hitter starts with both feet BEHIND the back line of the box.',
        'Walk the back foot into the box, then immediately stride and swing.',
        'Forward momentum loads the legs without the kid thinking about it.',
        'Six reps, then a normal stance. The legs stay "on" automatically.'
      ],
      time: '8 min', gear: 'Tee or soft toss', audience: 'parent'
    },
    {
      title: 'Top-Half / Bottom-Half Tee',
      cue: 'Hit the back of the ball, slightly under center',
      steps: [
        'Mark a ball with a line around its equator. Set it on the tee, line facing the hitter.',
        'Goal: contact just BELOW the line, driving through the back-bottom quarter.',
        'Hitting on top = ground balls. Hitting way under = pop-ups. Under the line = line drives.',
        'Fifteen swings, count how many are true line drives.'
      ],
      time: '10 min', gear: 'Tee, marked ball, net', audience: 'parent'
    }
  ],

  cold_streak: [
    {
      title: 'Tee Reset',
      cue: 'Line drives, nothing fancy',
      steps: [
        'Tee at belt height, middle of the plate. No locations, no games.',
        'Goal: ten line drives in a row up the middle.',
        'Grounder or pop-up restarts the count. No exceptions.',
        'This is a confidence rebuilder. Slow the kid down and let them feel a good swing again.'
      ],
      time: '10 min', gear: 'Tee, net', audience: 'parent'
    },
    {
      title: 'Success Ladder',
      cue: 'Win something small first',
      steps: [
        'Start at a distance and speed the hitter can absolutely handle - short soft toss.',
        'Five hard-hit balls, then move back one step.',
        'Keep stepping back only after five good ones. Never end on a failure.',
        'Slumps at 10U are almost always confidence. Rebuild it with reps they win.'
      ],
      time: '15 min', gear: 'Soft toss, net', audience: 'parent'
    }
  ],

  low_contact: [
    {
      title: 'Small Ball / Big Bat',
      cue: 'Make the real thing feel easy',
      steps: [
        'Soft toss with golf-ball-sized wiffle balls and a normal bat.',
        'Twenty swings. Contact rate will be low at first - that is fine.',
        'Switch to a regular ball. It looks like a beach ball now.',
        'Sharpens focus and tightens the swing path fast.'
      ],
      time: '8 min', gear: 'Mini wiffles, bat, net', audience: 'parent'
    },
    {
      title: 'Number Ball',
      cue: 'Actually see the ball',
      steps: [
        'Write big numbers on six or eight balls with a marker.',
        'Toss underhand from the side. Hitter calls the number OUT LOUD as it comes in, then swings.',
        'If they cannot call the number, they were not tracking it.',
        'The single best drill for a kid who "just isn\'t seeing it".'
      ],
      time: '10 min', gear: 'Numbered balls, screen', audience: 'parent'
    }
  ],

  /* ================= PITCHING ================= */

  high_walks: [
    {
      title: 'Bullseye',
      cue: 'Throw to a spot, not to a person',
      steps: [
        'Catcher squats normally. Tape a 12-inch square on the fence behind them.',
        'Ten pitches at the square - count the hits.',
        'Move the square to a different corner every ten pitches.',
        '"Throw a strike" is too vague for a 10-year-old. Give the eyes a target.'
      ],
      time: '15 min', gear: 'Tape, catcher, fence', audience: 'coach'
    },
    {
      title: 'Knee Drill',
      cue: 'Upper body only',
      steps: [
        'Pitcher kneels on the throwing-side knee, glove-side knee up.',
        'Throw to a partner 30 feet away. Focus only on arm path and finish.',
        'Taking the legs out isolates the release point.',
        'Twenty throws, must hit the partner chest-high. Then back to the mound.'
      ],
      time: '10 min', gear: 'Partner, ball', audience: 'parent'
    },
    {
      title: 'First-Pitch Strike Game',
      cue: 'The most important pitch of every at-bat',
      steps: [
        'Live BP. Each batter gets exactly one pitch, then rotates.',
        'Strike = +1, ball = -1. Run twenty batters.',
        'Post the score and track it across practices.',
        '0-1 counts win games at this age. 1-0 counts lose them.'
      ],
      time: '20 min', gear: 'Catcher, screen, batters', audience: 'coach'
    },
    {
      title: 'Towel Drill',
      cue: 'Full extension, no ball, no stress',
      steps: [
        'Pitcher holds a small towel in the throwing hand.',
        'Full delivery, snapping the towel at a target held at stride-length out front.',
        'Hearing the snap means they got out front. No snap means they cut it off early.',
        'Great for high pitch counts weeks - all the mechanics, zero arm stress.'
      ],
      time: '8 min', gear: 'Hand towel, partner', audience: 'parent'
    }
  ],

  high_era: [
    {
      title: 'Wrist Snap Release',
      cue: 'Snap down through the ball',
      steps: [
        'Stand 25 feet from a partner in the cocked position, arm up and elbow bent.',
        'No stride. Pump the wrist forward three times and release on the third.',
        'Hold the finish for three seconds.',
        'Builds the release that turns flat, hittable pitches into ones with downward life.'
      ],
      time: '10 min', gear: 'Partner, ball', audience: 'parent'
    },
    {
      title: 'Quiet Front Side',
      cue: 'Glove pulls to the ribs',
      steps: [
        'Slow-motion delivery, focusing only on the glove arm.',
        'As the throwing arm comes through, the glove pulls IN to the chest - it does not fly open.',
        'A glove that flies open pulls the head off target and sends the ball high.',
        'Fifteen slow reps, ten at speed. The finish should feel stronger.'
      ],
      time: '10 min', gear: 'None', audience: 'parent'
    },
    {
      title: 'Down-Hill Plane',
      cue: 'Get on top of the ball',
      steps: [
        'Set a chair or bucket about halfway to home, just outside the pitcher\'s sight line.',
        'The pitch must clear the bucket and still finish in the lower half of the zone.',
        'Teaches the ball to arrive on a downward angle instead of flat.',
        'Flat pitches at 10U get hit hard. Downhill pitches get topped into the ground.'
      ],
      time: '12 min', gear: 'Bucket, catcher', audience: 'coach'
    }
  ],

  low_strike: [
    {
      title: 'Call Your Shot',
      cue: 'Mental rep before the physical one',
      steps: [
        'Before every bullpen pitch the pitcher says out loud: "I am hitting the glove."',
        'Then steps on the rubber and throws.',
        'It sounds silly. Strike rate goes up for kids who do it.',
        'Twenty-five pitch bullpen, every single one called first.'
      ],
      time: '12 min', gear: 'Catcher', audience: 'parent'
    },
    {
      title: 'Three-Zone Bullpen',
      cue: 'Command, not just strikes',
      steps: [
        'Split the plate into three vertical zones: glove side, middle, arm side.',
        'Five pitches to each zone, in order, and call the zone before each one.',
        'Score out of fifteen. Write it on the board.',
        'Repeat weekly - the number climbing is the proof the work is working.'
      ],
      time: '15 min', gear: 'Catcher, cones', audience: 'coach'
    }
  ],

  high_whip: [
    {
      title: 'Weak Contact Bullpen',
      cue: 'Miss the barrel, not the zone',
      steps: [
        'Live batter in the box, but the batter does NOT swing.',
        'Pitcher works the bottom of the zone and the edges only.',
        'Coach calls out where each pitch actually finished.',
        'A strike at the knees beats a strike at the belt every time at 10U.'
      ],
      time: '15 min', gear: 'Catcher, standing batter', audience: 'coach'
    }
  ],

  /* ================= FIELDING ================= */

  high_errors: [
    {
      title: 'Short Hop Reaction',
      cue: 'Attack the hop, do not wait on it',
      steps: [
        'Partner kneels 15 feet away and throws firm short hops.',
        'Fielder stays low, glove out front, and works THROUGH the ball.',
        'Twenty-five reps. Bare hand or glove only - no cross-over step.',
        'Almost every 10U error is a ball played back on the heels.'
      ],
      time: '10 min', gear: 'Partner, ball', audience: 'parent'
    },
    {
      title: 'Triangle Ground Balls',
      cue: 'Feet make the play, hands finish it',
      steps: [
        'Three cones in a triangle about six feet apart.',
        'Roll a ball to each cone in turn. Fielder must field it inside the triangle.',
        'Forces footwork to the ball instead of reaching sideways.',
        'Three rounds of nine. Count the clean ones.'
      ],
      time: '12 min', gear: 'Cones, balls', audience: 'coach'
    },
    {
      title: 'No-Glove Fundamentals',
      cue: 'Two hands, soft hands',
      steps: [
        'Field rolled ground balls with bare hands only, using a tennis ball or soft ball.',
        'Kids cannot get lazy with the glove because there is no glove.',
        'Watch for: butt down, hands out front, ball fielded in the middle.',
        'Twenty reps bare hands, then twenty with the glove. The difference is obvious.'
      ],
      time: '10 min', gear: 'Tennis balls', audience: 'parent'
    }
  ],

  low_fpct: [
    {
      title: 'Four-Corner Catch',
      cue: 'Clean transfer, accurate throw',
      steps: [
        'Four players on four bases. Ball goes around the horn.',
        'Every catch must be followed by a glove-to-hand transfer and a chest-high throw.',
        'One lap clean = one point. Drop or bad throw resets.',
        'Play to five points. The errors at 10U are usually the throw, not the catch.'
      ],
      time: '12 min', gear: 'Bases, ball', audience: 'coach'
    }
  ],

  /* ================= CATCHING ================= */

  high_pb: [
    {
      title: 'Blocking Progression',
      cue: 'Chest to the ball, chin down',
      steps: [
        'Catcher in gear, no glove hand involved. Coach throws balls in the dirt from 15 feet.',
        'Goal is not to catch it - it is to get the chest square and keep it in front.',
        'Chin tucks, shoulders round forward, glove fills the five-hole.',
        'Fifteen blocks, then fifteen with lateral movement left and right.'
      ],
      time: '12 min', gear: 'Full gear, soft balls', audience: 'coach'
    },
    {
      title: 'Bare-Hand Behind Back',
      cue: 'Take the hands out of it',
      steps: [
        'Catcher blocks with the throwing hand tucked behind the back, glove hand only in the five-hole.',
        'Protects the hand and forces pure body blocking.',
        'Twenty reps with tennis balls or incrediballs.',
        'Passed balls at 10U come from reaching with the glove instead of moving the body.'
      ],
      time: '10 min', gear: 'Soft balls, gear', audience: 'parent'
    }
  ],

  low_cs: [
    {
      title: 'Pop-Time Ladder',
      cue: 'Fast feet, short arm action',
      steps: [
        'Time from ball hitting the mitt to ball reaching second base. Use a phone stopwatch.',
        'Work the transfer only first - no throw, just glove to hand, fifty reps.',
        'Then add the footwork: replace-step, then throw.',
        'Write the time down every week. Kids chase a number they can see.'
      ],
      time: '15 min', gear: 'Stopwatch, gear, partner', audience: 'coach'
    }
  ],

  /* ================= BASERUNNING / GENERAL ================= */

  team_focus_general: [
    {
      title: 'Situations Circuit',
      cue: 'Know the play before the pitch',
      steps: [
        'Set a game situation out loud: "Runner on second, one out."',
        'Before the coach hits, every player calls where they are going with the ball.',
        'Hit it. Anyone who hesitated does it again.',
        'Ten situations. This is the single highest-value thing you can do at 10U.'
      ],
      time: '20 min', gear: 'Full defense, fungo', audience: 'coach'
    }
  ]
};

/* --------------------------------------------------------------------------
   Pull a set of drills for a list of detected issues.
   -------------------------------------------------------------------------- */
P10.drillsFor = function (issueKeys, perIssue) {
  perIssue = perIssue || 2;
  var out = [], seen = {};
  (issueKeys || []).forEach(function (key) {
    var list = P10.DRILLS[key] || [];
    list.slice(0, perIssue).forEach(function (d) {
      if (seen[d.title]) return;
      seen[d.title] = true;
      out.push(Object.assign({ issue: key }, d));
    });
  });
  return out;
};
