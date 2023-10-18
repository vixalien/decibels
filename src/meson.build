gnome = import('gnome')

sources = [
  'application.ts',
  'drag-overlay.ts',
  'empty.ts',
  'error.ts',
  'header.ts',
  'main.ts',
  'mpris.ts',
  'playback-rate-button.ts',
  'player.ts',
  'stream.ts',
  'waveform.ts',
  'window.ts',
]

outputs = []
foreach source : sources
    outputs += source.replace('.ts', '.js')
endforeach

typescript = custom_target(
  'typescript-compile',
  input: files(sources),
  build_by_default: true,
  command: [ tsc, '--project', tsconfig, '--outDir', '@OUTDIR@' ],
  output: outputs,
)

source_res_conf = configuration_data()
source_res_conf.set('profile', profile)
src_res = gnome.compile_resources(
 application_id + '.src',
 configure_file(
  	input: 'com.vixalien.decibels.src.gresource.xml.in',
  	output: '@BASENAME@',
  	configuration: source_res_conf
  ),
  dependencies: typescript,
  gresource_bundle: true,
  install: true,
  install_dir: decibels_pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', '@0@@1@'.format(meson.project_version(), version_suffix))
bin_conf.set('APPLICATION_ID', application_id)
bin_conf.set('prefix', decibels_prefix)
bin_conf.set('libdir', decibels_libdir)
bin_conf.set('datadir', decibels_datadir)
bin_conf.set('resource_path', '/com/vixalien/decibels@0@'.format(profile))
bin_conf.set('profile', profile)

app_launcher = configure_file(
  input: 'com.vixalien.decibels.in',
  output: application_id,
  configuration: bin_conf,
  install: true,
  install_dir: decibels_bindir
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)
