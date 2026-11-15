#!/bin/bash
# =====================================================================
#  ScoreDAW — cross-build of the native engine with MinGW-w64 (Linux)
#  Produces: ScoreDawEngine.dll and ScoreDawScan.exe (64-bit, static runtime)
#  Usage: ./build_mingw.sh <vst3sdk dir> <clap dir> <output dir>
#  On Windows use CMakeLists.txt with Visual Studio 2022 instead.
# =====================================================================
set -e
VST3=${1:-../third_party/vst3sdk}; CLAP=${2:-../third_party/clap}; OUT=${3:-../dist}
CXX=x86_64-w64-mingw32-g++-posix
OBJ=build-mingw; mkdir -p $OBJ $OUT
FLAGS="-std=c++17 -O2 -DUNICODE -D_UNICODE -DRELEASE=1 -DNOMINMAX -I$VST3 -I$CLAP/include -I."
SDK_SRC="base/source/baseiids.cpp base/source/fbuffer.cpp base/source/fdebug.cpp base/source/fobject.cpp
 base/source/fstreamer.cpp base/source/fstring.cpp base/source/updatehandler.cpp base/thread/source/fcondition.cpp
 base/thread/source/flock.cpp pluginterfaces/base/conststringtable.cpp pluginterfaces/base/coreiids.cpp
 pluginterfaces/base/funknown.cpp pluginterfaces/base/ustring.cpp public.sdk/source/common/commoniids.cpp
 public.sdk/source/common/commonstringconvert.cpp public.sdk/source/common/memorystream.cpp
 public.sdk/source/vst/utility/stringconvert.cpp public.sdk/source/vst/vstinitiids.cpp
 public.sdk/source/vst/hosting/module.cpp public.sdk/source/vst/hosting/module_win32.cpp
 public.sdk/source/vst/hosting/hostclasses.cpp public.sdk/source/vst/hosting/plugprovider.cpp
 public.sdk/source/vst/hosting/processdata.cpp public.sdk/source/vst/hosting/eventlist.cpp
 public.sdk/source/vst/hosting/parameterchanges.cpp public.sdk/source/vst/hosting/connectionproxy.cpp
 public.sdk/source/vst/hosting/pluginterfacesupport.cpp public.sdk/source/common/threadchecker_win32.cpp"
OBJS=""
for f in $SDK_SRC; do o=$OBJ/sdk_$(echo $f | tr / _).o; [ -f $o ] || $CXX $FLAGS -c $VST3/$f -o $o; OBJS="$OBJS $o"; done
for f in vst3host.cpp claphost.cpp engine.cpp; do o=$OBJ/${f%.cpp}.o; $CXX $FLAGS -c $f -o $o; OBJS="$OBJS $o"; done
LIBS="-s -static -static-libgcc -static-libstdc++ -lole32 -loleaut32 -luuid -lavrt -lshell32 -lshlwapi -luser32 -lgdi32 -lwinmm -lksuser"
$CXX -shared -o $OUT/ScoreDawEngine.dll $OBJS -Wl,--out-implib,$OBJ/libScoreDawEngine.a $LIBS
$CXX $FLAGS -DSDAW_BUILD_DLL -municode -c scan_main.cpp -o $OBJ/scan_main.o
$CXX -municode -o $OUT/ScoreDawScan.exe $OBJ/scan_main.o $OBJS $LIBS
echo "Built $OUT/ScoreDawEngine.dll and $OUT/ScoreDawScan.exe"
