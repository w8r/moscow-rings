const L = global.L || require('leaflet');

export default class FormController {

  constructor(form) {
    this.form = form;
    this.getElements();
    this.addListeners();
  }

  getElements () {
    this.openButton = this.form.getElementsByTagName("i")[0];
    this.input = this.form.getElementsByTagName("input")[0];
    this.deselect = document.getElementsByClassName("deselect")[0];
  }

  _focus(e) {
    L.DomUtil.removeClass(this.form, "submitted");
    L.DomUtil.addClass(this.form, "enter-search");
    this.input.focus();
  }

  addListeners () {
    L.DomEvent.on(this.openButton, "click", this._focus, this);
    L.DomEvent.on(this.input, "click", this._focus, this);

    L.DomEvent.on(this.form, "submit", (e) => {
      e.preventDefault()
      L.DomUtil.removeClass(this.form, "enter-search");
      L.DomUtil.addClass(this.form, "submitted");;
      this.form.getElementsByTagName("input")[0].blur();
    }, this);

    L.DomEvent.on(this.deselect, "click" , (e) => {
      L.DomUtil.removeClass(this.form, "enter-search");
      L.DomUtil.removeClass(this.form, "submitted");
      this.form.getElementsByTagName("input")[0].blur();
    }, this);
  }
}
