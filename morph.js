// Port of your C++ Spiromorph to JavaScript
class Spiromorph {
  constructor(options) {
    // copy options
    this.options = Object.assign({}, options);

    // arrays
    this.base_resolution = this.options.base_resolution;
    this.sin_table = new Float32Array(this.base_resolution);
    this.colour_table = new Array(this.base_resolution);
    this.elements = new Array(this.options.number_of_elements);
    this.envelopes = new Array(this.options.number_of_elements);

    // geometry / origin
    this.center_x = this.options.window_width / 2;
    this.center_y = this.options.window_height / 2;

    this.element_radius = (this.options.amplitude * 0.5 * this.options.window_height /
      ((this.options.number_of_elements - this.options.envelopes_in_phase + 1) * 0.5 + (this.options.envelopes_in_phase - 1) * 1.0));

    for (let i=0;i<this.options.number_of_elements;i++){
      this.elements[i] = { freq: 1, amplitude: 1.0, phase_offset: 0 };
      this.envelopes[i] = { offset: 0.0, reset: false };
    }

    this.base_envelope = 0.0;
    this.spiroFrameTime = 0;
    this.envelope = 0;

    this.generate_sin_table();
    this.envelope_init();
    this.colour_table_init();
  }

  // --- helpers ---
  generate_sin_table(){
    for(let brads=0;brads<this.base_resolution;brads++){
      let q = (brads / this.base_resolution) * 2.0 * Math.PI;
      this.sin_table[brads] = Math.sin(q);
    }
  }

  envelope_init(){
    for(let i=0;i<this.options.number_of_elements;i++) this.envelopes[i].offset = 0.0;
    for(let i=0;i<this.options.number_of_elements - this.options.envelopes_in_phase + 1;i++){
      this.envelopes[i].offset = i / (this.options.number_of_elements - this.options.envelopes_in_phase + 1);
    }
  }

  raised_cosine(position){
    // position in 0..1
    let brads = Math.floor(position * this.base_resolution);
    brads += Math.floor(this.base_resolution/4);
    brads &= (this.base_resolution - 1);
    return (this.sin_table[brads] / -2.0) + 0.5;
  }

  rand_in_range_i(min, max){
    let range = Math.abs(max - min);
    if(range === 0) return min;
    let v = Math.floor(Math.random() * range);
    return (min < max) ? (v + min) : (v + max);
  }

  colour_table_init(){
    for(let i=0;i<this.base_resolution;i++){
      let pos = i / this.base_resolution;
      let r = 255.0 * this.raised_cosine(pos + 0.0000);
      let g = 255.0 * this.raised_cosine(pos + 0.3333);
      let b = 255.0 * this.raised_cosine(pos + 0.6666);
      this.colour_table[i] = { r: r|0, g: g|0, b: b|0 };
    }
  }

  // calc a point on unit circle table scaled by radius
  calc_point_of_circle(brads, radius){
    // wrap using bitmask (assumes base_resolution is power of two like in C++)
    brads &= (this.base_resolution-1);
    let px = this.sin_table[brads] * radius;
    brads += (this.base_resolution >> 2); // + base_resolution/4
    brads &= (this.base_resolution-1);
    let py = this.sin_table[brads] * radius;
    return { x: px, y: py };
  }

  calc_point_of_element(element, base_angle){
    // freq = element.freq * base_angle + phase_offset
    let freq = (element.freq * base_angle) + element.phase_offset;
    let amplitude = element.amplitude * this.element_radius;
    return this.calc_point_of_circle(freq, amplitude);
  }

  sum_points(a,b){
    return { x: a.x + b.x, y: a.y + b.y };
  }

  // produce list of points and colors for entire base resolution
  generate_points_and_colors(width, height){
    // update center in case canvas resized
    this.center_x = width / 2;
    this.center_y = height / 2;

    const pts = new Float32Array((this.base_resolution + 1) * 5); // x,y,r,g,b (+1 to close loop)
    
    for(let base_angle=0;base_angle<this.base_resolution;base_angle++){
      // sum elements
      let p = { x:0.0, y:0.0 };
      for(let i=0;i<this.options.number_of_elements;i++){
        let el = this.elements[i];
        let c = this.calc_point_of_element(el, base_angle);
        p = this.sum_points(p, c);
      }
      let idx = base_angle * 5;
      pts[idx+0] = this.center_x + p.x;
      pts[idx+1] = this.center_y + p.y;

      let col = this.colour_table[base_angle];
      // normalize color to 0..1
      pts[idx+2] = col.r / 255.0;
      pts[idx+3] = col.g / 255.0;
      pts[idx+4] = col.b / 255.0;
    }
    
    // Close the loop by duplicating the first point at the end
    pts[this.base_resolution * 5 + 0] = pts[0];
    pts[this.base_resolution * 5 + 1] = pts[1];
    pts[this.base_resolution * 5 + 2] = pts[2];
    pts[this.base_resolution * 5 + 3] = pts[3];
    pts[this.base_resolution * 5 + 4] = pts[4];
    
    return pts;
  }

  // mirror of Update(float FrameTime)
  Update(FrameTime){
    this.spiroFrameTime = FrameTime;
    // rotate base envelope
    this.base_envelope += this.options.envelope_speed * this.spiroFrameTime;
    if(this.base_envelope >= 1.0) this.base_envelope -= 1.0;

    for(let i=0;i<this.options.number_of_elements;i++){
      let envelope = this.envelopes[i].offset + this.base_envelope;
      if(envelope >= 1.0) envelope -= 1.0;

      if(envelope < 0.5 && !this.envelopes[i].reset){
        this.elements[i].freq = this.rand_in_range_i(1, this.options.element_freq_max);
        if(Math.random() < 0.5) this.elements[i].freq *= -1;
        this.elements[i].phase_offset = this.rand_in_range_i(0, this.base_resolution);
      }
      this.envelopes[i].reset = (envelope < 0.5);
      this.elements[i].amplitude = this.raised_cosine(envelope);
    }
  }

  reinit(window_height){
    this.options.window_height = window_height;
    this.element_radius = (this.options.amplitude * 0.5 * this.options.window_height /
      ((this.options.number_of_elements - this.options.envelopes_in_phase + 1) * 0.5 + (this.options.envelopes_in_phase - 1) * 1.0));
    this.envelope_init();
  }

  ReinitNumberOfElements(n){
    // reallocate arrays
    this.options.number_of_elements = n;
    this.elements = new Array(n);
    this.envelopes = new Array(n);
    for(let i=0;i<n;i++){
      this.elements[i] = { freq:1, amplitude:1.0, phase_offset:0 };
      this.envelopes[i] = { offset:0.0, reset:false };
    }
    this.reinit(this.options.window_height);
  }
}