const L = global.L || require('leaflet');

export default class FormController {

  constructor(form) {
    this.form = form;
    this.getElements();
    this.addListeners();
  }

  getElements () {
    this.openButton = this.form.querySelector("i");
    this.input = this.form.querySelector("input");
    this.deselect = document.querySelector(".deselect");
  }

  _focus(e) {
    this.setValue(this.input.value);
    this.input.focus();
  }

  addListeners () {
    L.DomEvent
      .on(this.openButton, "click", this._focus, this)
      .on(this.input, "click", this._focus, this)

      .on(this.form, "submit", this._onSubmit, this);

    L.DomEvent.on(this.deselect, "click" , (e) => {
      L.DomUtil.removeClass(this.form, "enter-search");
      L.DomUtil.removeClass(this.form, "submitted");
      this.input.blur();
    }, this);
  }

  setValue(value) {
    this.input.value = value;
    L.DomUtil.removeClass(this.form, "submitted");
    L.DomUtil.addClass(this.form, "enter-search");
  }

  _onSubmit(e) {
    e.preventDefault()
    L.DomUtil.removeClass(this.form, "enter-search");
    L.DomUtil.addClass(this.form, "submitted");
    this.form.getElementsByTagName("input")[0].blur();

    this.fire('submit', { query: this.input.value });
  }
}
L.Util.extend(FormController.prototype, L.Mixin.Events);
