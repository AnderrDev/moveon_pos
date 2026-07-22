import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { receiptSettingsFormMapper } from '@angular-app/features/settings/presentation/forms/receipt-settings-form.mapper'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormCheckboxComponent } from '@angular-app/shared/molecules/form-checkbox.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ReceiptSettingsFormPresenter } from '@angular-app/features/settings/presentation/presenters/receipt-settings-form.presenter'
import { ReceiptSettingsRepository } from '@angular-app/features/settings/domain/repositories/receipt-settings.repository'
import { saveReceiptSettings } from '@angular-app/features/settings/domain/usecases/save-receipt-settings.use-case'
import { LoyaltySettingsFormPresenter } from '@angular-app/features/settings/presentation/presenters/loyalty-settings-form.presenter'
import { LoyaltySettingsRepository } from '@angular-app/features/settings/domain/repositories/loyalty-settings.repository'
import { saveLoyaltySettings } from '@angular-app/features/settings/domain/usecases/save-loyalty-settings.use-case'
import { loyaltySettingsFormMapper } from '@angular-app/features/settings/presentation/forms/loyalty-settings-form.mapper'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { QzReceiptPrinterService } from '@angular-app/features/pos/data/datasources/qz-receipt-printer.service'

@Component({
  selector: 'mo-configuracion-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReceiptSettingsFormPresenter, LoyaltySettingsFormPresenter],
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ButtonComponent,
    FormInputComponent,
    FormTextareaComponent,
    FormCheckboxComponent,
    FormErrorComponent,
    FormNumberInputComponent,
    FormCurrencyInputComponent,
  ],
  template: `
    <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12 md:pb-16">
      <mo-page-header
        title="Configuracion"
        subtitle="Personaliza el comprobante y la informacion visible en el punto de venta"
      />

      @if (loading()) {
        <div class="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="bg-card h-[34rem] rounded-xl border"></div>
          <div class="bg-card h-96 rounded-xl border"></div>
        </div>
      } @else {
        <form
          [formGroup]="presenter.form"
          (ngSubmit)="submit()"
          class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <div class="space-y-6">
            <article class="bg-card rounded-xl border p-6 shadow-sm sm:p-7">
              <div class="mb-6">
                <h2 class="font-display text-lg font-bold">Encabezado del comprobante</h2>
                <p class="text-muted-foreground mt-1 text-sm">
                  Define los datos comerciales visibles debajo del logo.
                </p>
              </div>

              <div class="grid gap-y-6">
                <mo-form-input
                  controlName="titulo"
                  label="Titulo de la tirilla"
                  placeholder="COMPROBANTE DE VENTA"
                  [required]="true"
                  [maxLength]="32"
                  [error]="presenter.errors().titulo ?? null"
                />

                <div class="grid gap-x-5 gap-y-6 sm:grid-cols-2">
                  <mo-form-input
                    controlName="nit"
                    label="NIT o identificacion"
                    placeholder="900123456-1"
                    [maxLength]="30"
                    [error]="presenter.errors().nit ?? null"
                  />
                  <mo-form-input
                    controlName="telefono"
                    label="Telefono"
                    type="tel"
                    placeholder="300 123 4567"
                    [maxLength]="30"
                    [error]="presenter.errors().telefono ?? null"
                  />
                </div>

                <div class="grid gap-x-5 gap-y-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <mo-form-input
                    controlName="direccion"
                    label="Direccion"
                    placeholder="Calle 10 # 20-30"
                    [maxLength]="100"
                    [error]="presenter.errors().direccion ?? null"
                  />
                  <mo-form-input
                    controlName="ciudad"
                    label="Ciudad"
                    placeholder="Medellin"
                    [maxLength]="60"
                    [error]="presenter.errors().ciudad ?? null"
                  />
                </div>
              </div>
            </article>

            <article class="bg-card rounded-xl border p-6 shadow-sm sm:p-7">
              <div class="mb-6">
                <h2 class="font-display text-lg font-bold">Contenido y salida</h2>
                <p class="text-muted-foreground mt-1 text-sm">
                  Elige que informacion imprimir y el nombre de la cola de Windows.
                </p>
              </div>

              <div class="grid gap-y-6">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="border-primary/25 bg-primary/5 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="imprimirAlFinalizarVenta"
                      label="Imprimir tirilla al completar una venta"
                      description="Define la opcion inicial del cobro. La venta puede cambiarla antes de confirmar."
                    />
                  </div>
                  <div class="border-primary/25 bg-primary/5 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="abrirCajonEnEfectivo"
                      label="Abrir caja con pagos en efectivo"
                      description="Abre el cajon al completar una venta que incluya efectivo, incluso si no imprime tirilla."
                    />
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="bg-muted/30 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="mostrarNit"
                      label="Mostrar NIT"
                      description="Imprime la identificacion si el campo tiene contenido."
                    />
                  </div>
                  <div class="bg-muted/30 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="mostrarDireccion"
                      label="Mostrar direccion"
                      description="Incluye direccion y ciudad en el encabezado."
                    />
                  </div>
                  <div class="bg-muted/30 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="mostrarTelefono"
                      label="Mostrar telefono"
                      description="Incluye el telefono comercial."
                    />
                  </div>
                  <div class="bg-muted/30 rounded-lg border p-4">
                    <mo-form-checkbox
                      controlName="mostrarIva"
                      label="Mostrar IVA"
                      description="Discrimina el IVA por tasa cuando la venta lo tenga."
                    />
                  </div>
                </div>

                <mo-form-textarea
                  controlName="mensajePie"
                  label="Mensaje final"
                  placeholder="Gracias por tu compra. Vuelve pronto!"
                  [rows]="3"
                  [error]="presenter.errors().mensajePie ?? null"
                />

                <mo-form-input
                  controlName="printerName"
                  label="Nombre de la impresora en Windows"
                  description="Debe coincidir exactamente con la impresora instalada."
                  placeholder="POS-58"
                  [required]="true"
                  [maxLength]="80"
                  [error]="presenter.errors().printerName ?? null"
                />
              </div>
            </article>

            <article class="bg-card rounded-xl border p-6 shadow-sm sm:p-7">
              <div class="mb-6">
                <h2 class="font-display text-lg font-bold">Visualizacion del punto de venta</h2>
                <p class="text-muted-foreground mt-1 text-sm">
                  Ajusta la informacion auxiliar visible para el cajero sin cambiar los calculos.
                </p>
              </div>

              <div class="bg-muted/30 rounded-lg border p-4">
                  <mo-form-checkbox
                    controlName="mostrarIvaEnPos"
                    label="Mostrar IVA en el punto de venta"
                    description="Muestra la tasa +IVA en las cards y el IVA en el resumen del carrito. Ocultarlo no modifica precios, impuestos ni ventas."
                  />
              </div>
            </article>

            <mo-form-error [message]="presenter.errors().root ?? null" />

            <div
              class="bg-card mb-4 flex flex-col gap-5 rounded-xl border p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold">Verifica antes de guardar</p>
                <p class="text-muted-foreground mt-1 max-w-md text-xs leading-relaxed">
                  Las pruebas usan la impresora indicada y no crean una venta.
                </p>
              </div>
              <div class="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:w-auto">
                <mo-button
                  type="button"
                  variant="outline"
                  [fullWidth]="true"
                  [loading]="printingTest()"
                  [disabled]="saving() || openingDrawer()"
                  loadingText="Imprimiendo..."
                  (click)="printTest()"
                >
                  Imprimir prueba
                </mo-button>
                <mo-button
                  type="button"
                  variant="outline"
                  [fullWidth]="true"
                  [loading]="openingDrawer()"
                  [disabled]="saving() || printingTest()"
                  loadingText="Abriendo..."
                  (click)="openDrawerTest()"
                >
                  Probar caja
                </mo-button>
                <mo-button
                  type="submit"
                  [fullWidth]="true"
                  [loading]="saving()"
                  [disabled]="printingTest() || openingDrawer()"
                  loadingText="Guardando..."
                >
                  Guardar configuracion
                </mo-button>
              </div>
            </div>
          </div>

          <aside class="bg-card overflow-hidden rounded-xl border shadow-sm lg:sticky lg:top-0">
            <div class="border-b px-5 py-4">
              <p class="font-display text-sm font-bold">Vista previa</p>
              <p class="text-muted-foreground mt-1 text-xs">Representacion aproximada en 58 mm</p>
            </div>
            <div class="bg-muted/30 p-6">
            <div class="border-border mx-auto w-full max-w-64 border-x bg-white px-4 py-6 text-black shadow-sm">
              <img
                src="assets/receipt/moveon-logo-thermal.png"
                alt="Logo MOVEON"
                class="mx-auto mb-3 h-auto w-32"
              />
              <p class="text-center font-mono text-xs font-bold uppercase">
                {{ presenter.form.controls.titulo.value || 'COMPROBANTE DE VENTA' }}
              </p>
              @if (presenter.form.controls.mostrarNit.value && presenter.form.controls.nit.value) {
                <p class="mt-1 text-center font-mono text-[10px]">
                  NIT {{ presenter.form.controls.nit.value }}
                </p>
              }
              @if (presenter.form.controls.mostrarDireccion.value && presenter.form.controls.direccion.value) {
                <p class="text-center font-mono text-[10px]">
                  {{ presenter.form.controls.direccion.value }}
                  @if (presenter.form.controls.ciudad.value) {
                    - {{ presenter.form.controls.ciudad.value }}
                  }
                </p>
              }
              @if (presenter.form.controls.mostrarTelefono.value && presenter.form.controls.telefono.value) {
                <p class="text-center font-mono text-[10px]">
                  Tel. {{ presenter.form.controls.telefono.value }}
                </p>
              }
              <div class="my-3 border-t border-dashed border-black"></div>
              <div class="space-y-1 font-mono text-[10px]">
                <p class="flex justify-between"><span>Producto ejemplo</span><span>$ 22.000</span></p>
                @if (presenter.form.controls.mostrarIva.value) {
                  <p class="flex justify-between"><span>IVA 19%</span><span>$ 4.180</span></p>
                }
                <p class="flex justify-between font-bold"><span>TOTAL</span><span>$ 26.180</span></p>
              </div>
              @if (presenter.form.controls.mensajePie.value) {
                <p class="mt-4 text-center font-mono text-[10px]">
                  {{ presenter.form.controls.mensajePie.value }}
                </p>
              }
            </div>
            <p class="text-muted-foreground mt-5 text-center text-xs leading-relaxed">
              Vista aproximada. La impresora usa 32 caracteres por linea.
            </p>
            </div>
          </aside>
        </form>

        <form
          [formGroup]="loyaltyPresenter.form"
          (ngSubmit)="submitLoyalty()"
          class="lg:max-w-[calc(100%-21.5rem)]"
        >
          <article class="bg-card rounded-xl border p-6 shadow-sm sm:p-7">
            <div class="mb-6">
              <h2 class="font-display text-lg font-bold">MOVE ON Club</h2>
              <p class="text-muted-foreground mt-1 text-sm">
                Reglas del programa de fidelización. Aplican a los sellos y recompensas
                que se generen desde el momento en que guardes.
              </p>
            </div>

            <div class="grid gap-y-6">
              <div class="border-primary/25 bg-primary/5 rounded-lg border p-4">
                <mo-form-checkbox
                  controlName="activo"
                  label="Programa activo"
                  description="Al desactivarlo las ventas dejan de otorgar sellos. Los saldos y recompensas existentes no se pierden."
                />
              </div>

              <div class="grid gap-x-5 gap-y-6 sm:grid-cols-3">
                <mo-form-number-input
                  controlName="sellosParaRecompensa"
                  label="Sellos por recompensa"
                  [min]="1"
                  [max]="50"
                  [required]="true"
                  [error]="loyaltyPresenter.errors().sellosParaRecompensa ?? null"
                />
                <mo-form-currency-input
                  controlName="valorRecompensaCop"
                  label="Valor máximo del batido gratis"
                  [max]="10000000"
                  [required]="true"
                  [error]="loyaltyPresenter.errors().valorRecompensaCop ?? null"
                />
                <mo-form-number-input
                  controlName="vigenciaDias"
                  label="Vigencia de la recompensa (días)"
                  [min]="1"
                  [max]="365"
                  [required]="true"
                  [error]="loyaltyPresenter.errors().vigenciaDias ?? null"
                />
              </div>

              <mo-form-error [message]="loyaltyPresenter.errors().root ?? null" />

              <div class="flex justify-end">
                <mo-button
                  type="submit"
                  [loading]="loyaltySaving()"
                  loadingText="Guardando..."
                >
                  Guardar programa
                </mo-button>
              </div>
            </div>
          </article>
        </form>
      }
    </section>
  `,
})
export class ConfiguracionPage {
  private readonly settings = inject(ReceiptSettingsRepository)
  private readonly loyaltySettings = inject(LoyaltySettingsRepository)
  private readonly printer = inject(QzReceiptPrinterService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(ReceiptSettingsFormPresenter)
  readonly loyaltyPresenter = inject(LoyaltySettingsFormPresenter)
  readonly loading = signal(true)
  readonly saving = signal(false)
  readonly loyaltySaving = signal(false)
  readonly printingTest = signal(false)
  readonly openingDrawer = signal(false)

  constructor() {
    void this.load()
  }

  async submit(): Promise<void> {
    if (this.saving() || this.printingTest() || this.openingDrawer()) return
    const value = this.presenter.validate()
    if (!value) return

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })
    try {
      await saveReceiptSettings({ repo: this.settings }, receiptSettingsFormMapper.toPayload(value))
      this.toast.success('Configuracion del comprobante guardada')
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo guardar la configuracion'))
    } finally {
      this.presenter.form.enable({ emitEvent: false })
      this.saving.set(false)
    }
  }

  async printTest(): Promise<void> {
    if (this.printingTest() || this.saving() || this.openingDrawer()) return
    const value = this.presenter.validate()
    if (!value) return

    const settings = receiptSettingsFormMapper.toPayload(value)
    this.printingTest.set(true)
    try {
      await this.printer.printTest(
        {
          titulo: settings.titulo,
          nit: settings.nit,
          direccion: settings.direccion,
          ciudad: settings.ciudad,
          telefono: settings.telefono,
          mensajePie: settings.mensajePie,
          mostrarNit: settings.mostrarNit,
          mostrarDireccion: settings.mostrarDireccion,
          mostrarTelefono: settings.mostrarTelefono,
          mostrarIva: settings.mostrarIva,
        },
        settings.printerName,
      )
      this.toast.success('Prueba enviada a la impresora')
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo imprimir la prueba'))
    } finally {
      this.printingTest.set(false)
    }
  }

  async openDrawerTest(): Promise<void> {
    if (this.openingDrawer() || this.saving() || this.printingTest()) return
    const printerName = this.presenter.form.controls.printerName.value.trim()
    if (!printerName) {
      this.presenter.setRootError('Escribe el nombre de la impresora para probar la caja')
      return
    }

    this.openingDrawer.set(true)
    try {
      await this.printer.openCashDrawer(printerName)
      this.toast.success('Pulso enviado a la caja monedero')
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo abrir la caja monedero'))
    } finally {
      this.openingDrawer.set(false)
    }
  }

  async submitLoyalty(): Promise<void> {
    if (this.loyaltySaving()) return
    const value = this.loyaltyPresenter.validate()
    if (!value) return

    this.loyaltySaving.set(true)
    this.loyaltyPresenter.form.disable({ emitEvent: false })
    try {
      await saveLoyaltySettings({ repo: this.loyaltySettings }, loyaltySettingsFormMapper.toPayload(value))
      this.toast.success('Programa MOVE ON Club guardado')
    } catch (error) {
      this.loyaltyPresenter.setRootError(
        getErrorMessage(error, 'No se pudo guardar el programa'),
      )
    } finally {
      this.loyaltyPresenter.form.enable({ emitEvent: false })
      this.loyaltySaving.set(false)
    }
  }

  private async load(): Promise<void> {
    try {
      const [settings, loyalty] = await Promise.all([
        this.settings.load(),
        this.loyaltySettings.load(),
      ])
      this.presenter.reset(receiptSettingsFormMapper.toFormValue(settings))
      this.loyaltyPresenter.reset(loyaltySettingsFormMapper.toFormValue(loyalty))
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo cargar la configuracion'))
    } finally {
      this.loading.set(false)
    }
  }
}
