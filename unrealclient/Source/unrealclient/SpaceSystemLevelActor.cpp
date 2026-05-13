#include "SpaceSystemLevelActor.h"
#include "SpaceSystemHUD.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "Camera/PlayerCameraManager.h"
#include "GameFramework/PlayerController.h"
#include "HttpModule.h"
#include "IWebSocket.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"
#include "WebSocketsModule.h"
#include "Widgets/SWeakWidget.h"

namespace
{
	constexpr float MapScale = 175.0f;
	constexpr float BasicMeshRadius = 50.0f;
	constexpr float BasicMeshHeight = 100.0f;
	constexpr float ShipVisualHeight = 265.0f;
	constexpr float ShipLabelHeight = 155.0f;
	constexpr float ShipBlendSeconds = 0.55f;
	constexpr float ShipRouteRadius = 5.0f;

	FLinearColor PlanetColor(const FString& PlanetId)
	{
		if (PlanetId == TEXT("earth")) return FLinearColor(0.18f, 0.55f, 0.92f);
		if (PlanetId == TEXT("luna")) return FLinearColor(0.72f, 0.77f, 0.82f);
		if (PlanetId == TEXT("mars")) return FLinearColor(0.86f, 0.31f, 0.2f);
		if (PlanetId == TEXT("jupiter")) return FLinearColor(0.82f, 0.52f, 0.26f);
		if (PlanetId == TEXT("saturn")) return FLinearColor(0.88f, 0.72f, 0.38f);
		if (PlanetId == TEXT("uranus")) return FLinearColor(0.3f, 0.82f, 0.78f);
		return FLinearColor(0.42f, 0.7f, 0.82f);
	}

	float PlanetScale(const FString& PlanetId)
	{
		if (PlanetId == TEXT("luna")) return 0.55f;
		if (PlanetId == TEXT("uranus")) return 0.9f;
		return 1.25f;
	}

	FLinearColor ShipColor(const FSpaceSystemShipView& Ship, const FString& ClientId)
	{
		if (Ship.OwnerClientId == ClientId) return FLinearColor(1.0f, 0.12f, 0.1f);
		if (Ship.Faction == TEXT("Union")) return FLinearColor(0.25f, 0.65f, 1.0f);
		if (Ship.Faction == TEXT("Guild")) return FLinearColor(0.95f, 0.22f, 0.16f);
		if (Ship.Faction == TEXT("League")) return FLinearColor(1.0f, 0.62f, 0.22f);
		if (Ship.Faction == TEXT("Compact")) return FLinearColor(0.9f, 0.78f, 0.36f);
		return FLinearColor(0.75f, 0.9f, 1.0f);
	}

	FString PlanetLabel(const FSpaceSystemPlanetView& Planet)
	{
		return FString::Printf(TEXT("%s\n%s"), *Planet.Name, *Planet.Faction);
	}

	float JsonNumber(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, float Fallback = 0.0f)
	{
		double Value = Fallback;
		return Object.IsValid() && Object->TryGetNumberField(FieldName, Value) ? static_cast<float>(Value) : Fallback;
	}

	FString JsonString(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, const FString& Fallback = FString())
	{
		FString Value;
		return Object.IsValid() && Object->TryGetStringField(FieldName, Value) ? Value : Fallback;
	}

	FVector2D JsonPosition(const TSharedPtr<FJsonObject>& Object)
	{
		return FVector2D(JsonNumber(Object, TEXT("x")), JsonNumber(Object, TEXT("z")));
	}

	TSharedPtr<FJsonObject> JsonObjectField(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName)
	{
		const TSharedPtr<FJsonObject>* Child = nullptr;
		return Object.IsValid() && Object->TryGetObjectField(FieldName, Child) && Child ? *Child : nullptr;
	}

	const TArray<TSharedPtr<FJsonValue>>* JsonArrayField(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName)
	{
		const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
		return Object.IsValid() && Object->TryGetArrayField(FieldName, Values) ? Values : nullptr;
	}
}

ASpaceSystemLevelActor::ASpaceSystemLevelActor()
{
	PrimaryActorTick.bCanEverTick = true;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	RootComponent = SceneRoot;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> TranslucentMaterialAsset(TEXT("/Engine/EngineDebugMaterials/M_SimpleUnlitTranslucent.M_SimpleUnlitTranslucent"));

	SphereMesh = SphereAsset.Object;
	CubeMesh = CubeAsset.Object;
	CylinderMesh = CylinderAsset.Object;
	BaseMaterial = MaterialAsset.Object;
	TranslucentMaterial = TranslucentMaterialAsset.Object;
	if (!TranslucentMaterial)
	{
		TranslucentMaterial = BaseMaterial;
	}
}

void ASpaceSystemLevelActor::BeginPlay()
{
	Super::BeginPlay();

	BuildPlanetData();
	BuildLighting();
	BuildGrid();
	BuildStars();
	RebuildRefreshableScene();
	CreateHUD();
	ConnectToServer();
}

void ASpaceSystemLevelActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	bAllowReconnect = false;
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(ReconnectTimer);
	}

	if (WorldSocket.IsValid())
	{
		WorldSocket->Close();
		WorldSocket.Reset();
	}

	if (HUDWidget.IsValid())
	{
		if (GEngine && GEngine->GameViewport)
		{
			GEngine->GameViewport->RemoveViewportWidgetContent(
				SNew(SWeakWidget).PossiblyNullContent(HUDWidget.ToSharedRef())
			);
		}
		HUDWidget.Reset();
	}

	Super::EndPlay(EndPlayReason);
}

void ASpaceSystemLevelActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	TickShipAnimations(DeltaSeconds);
	TickClickToMove();
	FaceLabelsToCamera();
}

void ASpaceSystemLevelActor::BuildPlanetData()
{
	Planets = {
		{TEXT("earth"), TEXT("Earth"), TEXT("Union"), FVector2D(-10.0f, 0.0f), PlanetColor(TEXT("earth")), PlanetScale(TEXT("earth"))},
		{TEXT("luna"), TEXT("Luna"), TEXT("Union"), FVector2D(-8.7f, 0.9f), PlanetColor(TEXT("luna")), PlanetScale(TEXT("luna"))},
		{TEXT("mars"), TEXT("Mars"), TEXT("Guild"), FVector2D(2.5f, -5.2f), PlanetColor(TEXT("mars")), PlanetScale(TEXT("mars"))},
		{TEXT("jupiter"), TEXT("Jupiter"), TEXT("League"), FVector2D(13.2f, -1.4f), PlanetColor(TEXT("jupiter")), PlanetScale(TEXT("jupiter"))},
		{TEXT("saturn"), TEXT("Saturn"), TEXT("Compact"), FVector2D(26.0f, 5.4f), PlanetColor(TEXT("saturn")), PlanetScale(TEXT("saturn"))},
		{TEXT("uranus"), TEXT("Uranus Fuel Mine"), TEXT("Frontier"), FVector2D(39.0f, -6.2f), PlanetColor(TEXT("uranus")), PlanetScale(TEXT("uranus"))}
	};
}

void ASpaceSystemLevelActor::BuildLighting()
{
	UDirectionalLightComponent* KeyLight = NewObject<UDirectionalLightComponent>(this, TEXT("KeyLight"));
	KeyLight->SetupAttachment(SceneRoot);
	KeyLight->SetRelativeRotation(FRotator(-58.0f, -32.0f, 0.0f));
	KeyLight->SetIntensity(3.2f);
	KeyLight->SetCastShadows(false);
	KeyLight->RegisterComponent();

	USkyLightComponent* SkyLight = NewObject<USkyLightComponent>(this, TEXT("SoftSpaceLight"));
	SkyLight->SetupAttachment(SceneRoot);
	SkyLight->SetIntensity(0.45f);
	SkyLight->RegisterComponent();
}

void ASpaceSystemLevelActor::BuildGrid()
{
	AddMesh(TEXT("SpaceFloor"), CubeMesh, FVector(2500.0f, -150.0f, -12.0f), FVector(92.0f, 34.0f, 0.05f), FLinearColor(0.015f, 0.02f, 0.035f), false);
	if (!bShowMapGrid)
	{
		return;
	}

	for (int32 Index = -12; Index <= 48; Index += 4)
	{
		const float X = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridX_%d"), Index), FVector(X, -1780.0f, 4.0f), FVector(X, 1480.0f, 4.0f), 1.4f, FLinearColor(0.018f, 0.034f, 0.046f), false);
	}

	for (int32 Index = -10; Index <= 8; Index += 4)
	{
		const float Y = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridY_%d"), Index), FVector(-2080.0f, Y, 4.0f), FVector(7080.0f, Y, 4.0f), 1.4f, FLinearColor(0.018f, 0.034f, 0.046f), false);
	}
}

void ASpaceSystemLevelActor::BuildStars()
{
	FRandomStream Stream(3016);
	for (int32 Index = 0; Index < 90; ++Index)
	{
		const FVector Location(
			Stream.FRandRange(-2800.0f, 8400.0f),
			Stream.FRandRange(-2200.0f, 2100.0f),
			Stream.FRandRange(450.0f, 1900.0f));
		const float StarScale = Stream.FRandRange(0.018f, 0.052f);
		AddMesh(*FString::Printf(TEXT("Star_%02d"), Index), SphereMesh, Location, FVector(StarScale), FLinearColor(0.62f, 0.78f, 0.95f), false);
	}
}

void ASpaceSystemLevelActor::FaceLabelsToCamera()
{
	const APlayerCameraManager* CameraManager = UGameplayStatics::GetPlayerCameraManager(this, 0);
	if (!CameraManager)
	{
		return;
	}

	const FVector CameraLocation = CameraManager->GetCameraLocation();
	for (UTextRenderComponent* Label : LabelComponents)
	{
		if (!IsValid(Label))
		{
			continue;
		}

		const FVector ToCamera = CameraLocation - Label->GetComponentLocation();
		if (!ToCamera.IsNearlyZero())
		{
			FRotator Rotation = ToCamera.Rotation();
			Rotation.Roll = 0.0f;
			Label->SetWorldRotation(Rotation);
		}
	}

	LabelComponents.RemoveAll([](const TObjectPtr<UTextRenderComponent>& Label) {
		return !IsValid(Label.Get());
	});
}

void ASpaceSystemLevelActor::RebuildRefreshableScene()
{
	ClearRefreshableScene();
	if (bShowTradeRoutes)
	{
		BuildRoutes();
	}
	BuildSosSignals();
	BuildPlanets();
	BuildShips();
	BuildStatusBeacon();
	RefreshableSceneSignature = BuildRefreshableSceneSignature();
	bHasRefreshableSceneSignature = true;
}

void ASpaceSystemLevelActor::ClearRefreshableScene()
{
	for (UActorComponent* Component : RefreshableComponents)
	{
		if (Component)
		{
			if (UTextRenderComponent* Label = Cast<UTextRenderComponent>(Component))
			{
				LabelComponents.Remove(Label);
			}
			Component->DestroyComponent();
		}
	}
	RefreshableComponents.Reset();
}

void ASpaceSystemLevelActor::BuildRoutes()
{
	for (int32 Index = 1; Index < Planets.Num(); ++Index)
	{
		AddCylinderLine(
			*FString::Printf(TEXT("TradeRoute_%d"), Index),
			ToWorldPosition(Planets[Index - 1].MapPosition, 24.0f),
			ToWorldPosition(Planets[Index].MapPosition, 24.0f),
			3.0f,
			FLinearColor(0.04f, 0.09f, 0.13f));
	}
}

void ASpaceSystemLevelActor::BuildSosSignals()
{
	for (int32 Index = 0; Index < SosSignals.Num(); ++Index)
	{
		const FSpaceSystemSosSignalView& Signal = SosSignals[Index];
		const float Radius = FMath::Max(0.1f, Signal.Radius) * MapScale;
		AddMesh(*FString::Printf(TEXT("SosRadius_%d"), Index), CylinderMesh, ToWorldPosition(Signal.MapPosition, 5.0f), FVector(Radius / BasicMeshRadius, Radius / BasicMeshRadius, 0.012f), FLinearColor(1.0f, 0.38f, 0.02f, 0.28f), true, TranslucentMaterial);
	}
}

void ASpaceSystemLevelActor::BuildPlanets()
{
	if (ExploredAreas.Num() > 0)
	{
		for (int32 Index = 0; Index < ExploredAreas.Num(); ++Index)
		{
			const FSpaceSystemExploredAreaView& Area = ExploredAreas[Index];
			AddMesh(*FString::Printf(TEXT("ExploredArea_%d"), Index), CylinderMesh, ToWorldPosition(Area.Center, 2.0f), FVector((Area.Radius * MapScale) / BasicMeshRadius, (Area.Radius * MapScale) / BasicMeshRadius, 0.018f), FLinearColor(0.03f, 0.12f, 0.16f));
		}
	}

	for (const FSpaceSystemPlanetView& Planet : Planets)
	{
		const bool bExplored = ExploredAreas.Num() == 0 || IsPositionExplored(Planet.MapPosition);
		const float Radius = Planet.Scale * 82.0f;

		if (ExploredAreas.Num() == 0)
		{
			AddMesh(*FString::Printf(TEXT("Explored_%s"), *Planet.Id), CylinderMesh, ToWorldPosition(Planet.MapPosition, 2.0f), FVector((Radius * 3.6f) / BasicMeshRadius, (Radius * 3.6f) / BasicMeshRadius, 0.018f), FLinearColor(0.03f, 0.12f, 0.16f));
		}

		if (bExplored)
		{
			AddMesh(*FString::Printf(TEXT("Planet_%s"), *Planet.Id), SphereMesh, ToWorldPosition(Planet.MapPosition, Radius), FVector(Radius / BasicMeshRadius), Planet.Color);
			AddLabel(*FString::Printf(TEXT("Label_%s"), *Planet.Id), PlanetLabel(Planet), ToWorldPosition(Planet.MapPosition, Radius + 175.0f), 58.0f, FColor::White);
		}
		else
		{
			// Unexplored: dim marker
			AddMesh(*FString::Printf(TEXT("Planet_%s"), *Planet.Id), SphereMesh, ToWorldPosition(Planet.MapPosition, Radius), FVector(Radius / BasicMeshRadius), FLinearColor(0.08f, 0.08f, 0.12f, 0.4f));
			AddLabel(*FString::Printf(TEXT("Label_%s"), *Planet.Id), TEXT("???"), ToWorldPosition(Planet.MapPosition, Radius + 175.0f), 58.0f, FColor(80, 80, 110));
		}

		if (Planet.Id == TEXT("saturn") && bExplored)
		{
			AddMesh(TEXT("SaturnRing"), CylinderMesh, ToWorldPosition(Planet.MapPosition, Radius + 2.0f), FVector((Radius * 2.2f) / BasicMeshRadius, (Radius * 2.2f) / BasicMeshRadius, 0.025f), FLinearColor(0.72f, 0.58f, 0.28f));
		}
	}
}

void ASpaceSystemLevelActor::BuildShips()
{
	if (Ships.Num() == 0 && !bUsingLiveSnapshot)
	{
		FSpaceSystemShipView PreviewShip;
		PreviewShip.Id = TEXT("preview-ship");
		PreviewShip.Name = TEXT("Surveyor-01");
		PreviewShip.Faction = TEXT("Union");
		PreviewShip.OwnerClientId = ClientId;
		PreviewShip.MapPosition = FVector2D(-9.45f, -0.73f);
		PreviewShip.DestinationMapPosition = FVector2D(2.5f, -5.2f);
		PreviewShip.bHasDestination = true;
		PreviewShip.Fuel = 36.0f;
		PreviewShip.FuelCapacity = 60.0f;
		Ships.Add(PreviewShip);
	}

	TSet<FString> LiveShipIds;
	for (int32 Index = 0; Index < Ships.Num(); ++Index)
	{
		const FSpaceSystemShipView& Ship = Ships[Index];
		const FString ShipId = Ship.Id.IsEmpty() ? FString::Printf(TEXT("ship-%d"), Index + 1) : Ship.Id;

		const bool bOwned = Ship.OwnerClientId == ClientId;
		const bool bVisible = bOwned || ExploredAreas.Num() == 0 || IsPositionExplored(Ship.MapPosition);
		if (!bVisible)
		{
			continue;
		}

		LiveShipIds.Add(ShipId);

		FSpaceSystemShipRenderState& State = RenderedShips.FindOrAdd(ShipId);
		const bool bIsNewShip = !IsValid(State.Mesh.Get());
		const FVector2D VisualStart = bIsNewShip ? Ship.MapPosition : State.CurrentMapPosition;

		State.ShipId = ShipId;
		State.SourceMapPosition = VisualStart;
		State.TargetMapPosition = Ship.MapPosition;
		State.DestinationMapPosition = Ship.DestinationMapPosition;
		State.AnimationElapsedSeconds = 0.0f;
		State.AnimationDurationSeconds = VisualStart.Equals(Ship.MapPosition, 0.001f) ? 0.0f : ShipBlendSeconds;
		State.Speed = Ship.Speed;
		if (bOwned)
		{
			int32 CargoUsed = 0;
			for (const auto& Pair : Ship.Cargo) { CargoUsed += Pair.Value; }
			State.LabelText = FString::Printf(TEXT("%s\nFuel %.0f/%.0f  Cargo %d/%d  HP %d%%\nCredits %.0f"), *Ship.Name, Ship.Fuel, Ship.FuelCapacity, CargoUsed, Ship.CargoCapacity, FMath::RoundToInt(Ship.Health * 100.0f), Ship.Credits);
		}
		else
		{
			State.LabelText = FString::Printf(TEXT("%s\n%s"), *Ship.Name, *Ship.Faction);
		}
		State.LabelColor = bOwned ? FColor(255, 204, 204) : FColor(214, 234, 255);
		State.Color = ShipColor(Ship, ClientId);
		State.bHasDestination = Ship.bHasDestination;
		State.bShowDestinationLine = bShowShipDestinationLines && Ship.bHasDestination && bOwned;

		if (bIsNewShip)
		{
			State.CurrentMapPosition = Ship.MapPosition;
			State.Mesh = AddMesh(*FString::Printf(TEXT("Ship_%s"), *ShipId), CubeMesh, ToWorldPosition(Ship.MapPosition, ShipVisualHeight), bOwned ? FVector(0.42f, 0.28f, 0.18f) : FVector(0.34f, 0.23f, 0.15f), State.Color, false);
			State.Label = AddLabel(*FString::Printf(TEXT("ShipLabel_%s"), *ShipId), State.LabelText, ToWorldPosition(Ship.MapPosition, ShipVisualHeight + ShipLabelHeight), 48.0f, State.LabelColor, false);
		}

		UpdateRenderedShipComponents(State);
	}

	RemoveStaleRenderedShips(LiveShipIds);
}

void ASpaceSystemLevelActor::TickShipAnimations(float DeltaSeconds)
{
	const double ClientNowMs = FPlatformTime::ToMilliseconds64(FPlatformTime::Cycles64());
	const double ServerNowMs = ClientNowMs + ClockOffsetMs;
	const double ElapsedSinceSnapshotSeconds = FMath::Max(0.0, (ServerNowMs - SnapshotAtMs) / 1000.0);

	for (auto& RenderedShip : RenderedShips)
	{
		FSpaceSystemShipRenderState& State = RenderedShip.Value;

		// Phase 1: blend correction from old visual position to server anchor
		if (State.AnimationDurationSeconds > 0.0f)
		{
			State.AnimationElapsedSeconds = FMath::Min(State.AnimationElapsedSeconds + DeltaSeconds, State.AnimationDurationSeconds);
		}

		// Phase 2: dead-reckon from server anchor toward destination
		FVector2D DeadReckoned = State.TargetMapPosition;
		if (State.bHasDestination && State.Speed > 0.0f && SnapshotAtMs > 0.0)
		{
			const FVector2D Delta = State.DestinationMapPosition - State.TargetMapPosition;
			const float TotalDistance = Delta.Size();
			if (TotalDistance > 0.001f)
			{
				const float TravelDistance = State.Speed * static_cast<float>(ElapsedSinceSnapshotSeconds);
				const float Amount = FMath::Min(TravelDistance / TotalDistance, 1.0f);
				DeadReckoned = State.TargetMapPosition + Delta * Amount;
			}
		}

		// Combine: during blend window, lerp from old visual pos toward dead-reckoned pos
		if (State.AnimationDurationSeconds > 0.0f && State.AnimationElapsedSeconds < State.AnimationDurationSeconds)
		{
			const float Alpha = State.AnimationElapsedSeconds / State.AnimationDurationSeconds;
			State.CurrentMapPosition = State.SourceMapPosition + (DeadReckoned - State.SourceMapPosition) * Alpha;
		}
		else
		{
			State.CurrentMapPosition = DeadReckoned;
		}

		UpdateRenderedShipComponents(State);
	}
}

void ASpaceSystemLevelActor::RemoveStaleRenderedShips(const TSet<FString>& LiveShipIds)
{
	TArray<FString> StaleShipIds;
	for (const auto& RenderedShip : RenderedShips)
	{
		if (!LiveShipIds.Contains(RenderedShip.Key))
		{
			StaleShipIds.Add(RenderedShip.Key);
		}
	}

	for (const FString& ShipId : StaleShipIds)
	{
		if (FSpaceSystemShipRenderState* State = RenderedShips.Find(ShipId))
		{
			DestroyRenderedShip(*State);
		}
		RenderedShips.Remove(ShipId);
	}
}

void ASpaceSystemLevelActor::DestroyRenderedShip(FSpaceSystemShipRenderState& State)
{
	if (IsValid(State.Mesh.Get()))
	{
		State.Mesh->DestroyComponent();
	}

	if (IsValid(State.DestinationLine.Get()))
	{
		State.DestinationLine->DestroyComponent();
	}

	if (IsValid(State.Label.Get()))
	{
		LabelComponents.Remove(State.Label.Get());
		State.Label->DestroyComponent();
	}
}

void ASpaceSystemLevelActor::UpdateRenderedShipComponents(FSpaceSystemShipRenderState& State)
{
	const FVector ShipLocation = ToWorldPosition(State.CurrentMapPosition, ShipVisualHeight);

	if (IsValid(State.Mesh.Get()))
	{
		State.Mesh->SetWorldLocation(ShipLocation);
	}

	if (IsValid(State.Label.Get()))
	{
		State.Label->SetWorldLocation(ShipLocation + FVector(0.0f, 0.0f, ShipLabelHeight));
		State.Label->SetText(FText::FromString(State.LabelText));
		State.Label->SetTextRenderColor(State.LabelColor);
	}

	if (!State.bShowDestinationLine || !State.bHasDestination)
	{
		if (IsValid(State.DestinationLine.Get()))
		{
			State.DestinationLine->DestroyComponent();
			State.DestinationLine = nullptr;
		}
		return;
	}

	const FVector Destination = ToWorldPosition(State.DestinationMapPosition, 235.0f);
	if (!IsValid(State.DestinationLine.Get()))
	{
		State.DestinationLine = AddCylinderLine(*FString::Printf(TEXT("ActiveRoute_%s"), *State.ShipId), ShipLocation, Destination, ShipRouteRadius, State.Color, false);
		return;
	}

	UpdateCylinderLine(State.DestinationLine.Get(), ShipLocation, Destination, ShipRouteRadius);
}

void ASpaceSystemLevelActor::BuildStatusBeacon()
{
	const FString StatusText = FString::Printf(TEXT("Space System\n%s\nTick %d, planets %d, ships %d, SOS %d"), *ConnectionStatus, WorldTick, Planets.Num(), Ships.Num(), SosSignals.Num());
	const FVector StatusLocation(-1550.0f, -1200.0f, 360.0f);

	if (IsValid(StatusLabel.Get()))
	{
		StatusLabel->SetText(FText::FromString(StatusText));
		StatusLabel->SetWorldLocation(StatusLocation);
		return;
	}

	StatusLabel = AddLabel(TEXT("StatusBeacon"), StatusText, StatusLocation, 52.0f, FColor(178, 226, 255), false);
}

void ASpaceSystemLevelActor::UpdateLiveSceneFromSnapshot()
{
	const FString CurrentSignature = BuildRefreshableSceneSignature();
	if (!bHasRefreshableSceneSignature || CurrentSignature != RefreshableSceneSignature)
	{
		RebuildRefreshableScene();
		return;
	}

	BuildShips();
	BuildStatusBeacon();
}

FString ASpaceSystemLevelActor::BuildRefreshableSceneSignature() const
{
	FString Signature;
	for (const FSpaceSystemPlanetView& Planet : Planets)
	{
		Signature += FString::Printf(TEXT("P:%s:%.2f:%.2f:%.2f;"), *Planet.Id, Planet.MapPosition.X, Planet.MapPosition.Y, Planet.Scale);
	}

	for (const FSpaceSystemExploredAreaView& Area : ExploredAreas)
	{
		Signature += FString::Printf(TEXT("E:%.2f:%.2f:%.2f;"), Area.Center.X, Area.Center.Y, Area.Radius);
	}

	for (const FSpaceSystemSosSignalView& Signal : SosSignals)
	{
		Signature += FString::Printf(TEXT("S:%s:%.2f:%.2f:%.2f;"), *Signal.ClientId, Signal.MapPosition.X, Signal.MapPosition.Y, Signal.Radius);
	}

	return Signature;
}

void ASpaceSystemLevelActor::ConnectToServer()
{
	if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
	{
		FModuleManager::LoadModuleChecked<FWebSocketsModule>(TEXT("WebSockets"));
	}

	ConnectionStatus = FString::Printf(TEXT("connecting to %s"), *ServerHttpBaseUrl);
	RebuildRefreshableScene();

	WorldSocket = FWebSocketsModule::Get().CreateWebSocket(ServerWebSocketUrl);
	WorldSocket->OnConnected().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketConnected);
	WorldSocket->OnConnectionError().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketConnectionError);
	WorldSocket->OnClosed().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketClosed);
	WorldSocket->OnMessage().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketMessage);
	WorldSocket->Connect();
}

void ASpaceSystemLevelActor::ScheduleReconnect()
{
	if (!bAllowReconnect)
	{
		return;
	}

	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().SetTimer(ReconnectTimer, this, &ASpaceSystemLevelActor::ConnectToServer, 2.0f, false);
	}
}

void ASpaceSystemLevelActor::HandleSocketConnected()
{
	ConnectionStatus = FString::Printf(TEXT("connected to %s"), *ServerHttpBaseUrl);
	RebuildRefreshableScene();
}

void ASpaceSystemLevelActor::HandleSocketConnectionError(const FString& Error)
{
	ConnectionStatus = FString::Printf(TEXT("server connection failed: %s"), *Error);
	RebuildRefreshableScene();
	ScheduleReconnect();
}

void ASpaceSystemLevelActor::HandleSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean)
{
	ConnectionStatus = FString::Printf(TEXT("server disconnected: %s"), Reason.IsEmpty() ? TEXT("closed") : *Reason);
	RebuildRefreshableScene();
	ScheduleReconnect();
}

void ASpaceSystemLevelActor::HandleSocketMessage(const FString& Message)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return;
	}

	if (JsonString(Root, TEXT("type")) != TEXT("world"))
	{
		return;
	}

	ApplyWorldPayload(JsonObjectField(Root, TEXT("payload")));
}

void ASpaceSystemLevelActor::ApplyWorldPayload(const TSharedPtr<FJsonObject>& Payload)
{
	if (!Payload.IsValid())
	{
		return;
	}

	bUsingLiveSnapshot = true;
	WorldTick = static_cast<int32>(JsonNumber(Payload, TEXT("tick"), WorldTick));
	SnapshotAtMs = Payload->HasField(TEXT("snapshotAtMs")) ? Payload->GetNumberField(TEXT("snapshotAtMs")) : 0.0;
	if (SnapshotAtMs > 0.0)
	{
		ClockOffsetMs = SnapshotAtMs - FPlatformTime::ToMilliseconds64(FPlatformTime::Cycles64());
	}
	Planets.Reset();
	Ships.Reset();
	ExploredAreas.Reset();
	SosSignals.Reset();
	Stores.Reset();

	// Parse goods catalog for labels
	TMap<FString, FString> GoodsLabels;
	if (const TSharedPtr<FJsonObject> GoodsObject = JsonObjectField(Payload, TEXT("goods")))
	{
		for (const auto& GoodEntry : GoodsObject->Values)
		{
			const TSharedPtr<FJsonObject> GoodData = GoodEntry.Value->AsObject();
			if (GoodData.IsValid())
			{
				GoodsLabels.Add(GoodEntry.Key, JsonString(GoodData, TEXT("label"), GoodEntry.Key));
			}
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* PlanetValues = JsonArrayField(Payload, TEXT("planets")))
	{
		for (const TSharedPtr<FJsonValue>& PlanetValue : *PlanetValues)
		{
			const TSharedPtr<FJsonObject> PlanetObject = PlanetValue->AsObject();
			const FString PlanetId = JsonString(PlanetObject, TEXT("id"));
			if (PlanetId.IsEmpty())
			{
				continue;
			}

			FSpaceSystemPlanetView Planet;
			Planet.Id = PlanetId;
			Planet.Name = JsonString(PlanetObject, TEXT("name"), PlanetId);
			Planet.Faction = JsonString(PlanetObject, TEXT("faction"));
			Planet.MapPosition = JsonPosition(JsonObjectField(PlanetObject, TEXT("position")));
			Planet.Color = PlanetColor(PlanetId);
			Planet.Scale = PlanetScale(PlanetId);
			Planets.Add(Planet);

			// Parse stores for this planet
			if (const TArray<TSharedPtr<FJsonValue>>* StoreValues = JsonArrayField(PlanetObject, TEXT("stores")))
			{
				for (const TSharedPtr<FJsonValue>& StoreValue : *StoreValues)
				{
					const TSharedPtr<FJsonObject> StoreObject = StoreValue->AsObject();
					FSpaceSystemStoreView Store;
					Store.Id = JsonString(StoreObject, TEXT("id"));
					Store.Name = JsonString(StoreObject, TEXT("name"), Store.Id);
					Store.Credits = JsonNumber(StoreObject, TEXT("credits"));

					const TSharedPtr<FJsonObject> Inventory = JsonObjectField(StoreObject, TEXT("inventory"));
					const TSharedPtr<FJsonObject> Prices = JsonObjectField(StoreObject, TEXT("prices"));

					if (Inventory.IsValid() && Prices.IsValid())
					{
						for (const auto& Pair : Prices->Values)
						{
							FSpaceSystemStoreGoodView Good;
							Good.GoodId = Pair.Key;
							Good.Label = GoodsLabels.Contains(Pair.Key) ? GoodsLabels[Pair.Key] : Pair.Key;
							Good.Price = JsonNumber(Prices, *Pair.Key);
							Good.Stock = static_cast<int32>(JsonNumber(Inventory, *Pair.Key));
							Store.Goods.Add(Good);
						}
					}

					Stores.Add(Store);
				}
			}
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* PlayerValues = JsonArrayField(Payload, TEXT("players")))
	{
		for (const TSharedPtr<FJsonValue>& PlayerValue : *PlayerValues)
		{
			const TSharedPtr<FJsonObject> PlayerObject = PlayerValue->AsObject();
			FSpaceSystemShipView Ship;
			Ship.Id = JsonString(PlayerObject, TEXT("id"), FString::Printf(TEXT("ship-%d"), Ships.Num() + 1));
			Ship.Name = JsonString(PlayerObject, TEXT("name"), Ship.Id);
			Ship.Faction = JsonString(PlayerObject, TEXT("faction"));
			Ship.OwnerClientId = JsonString(PlayerObject, TEXT("ownerClientId"));
			Ship.DestinationPlanetId = JsonString(PlayerObject, TEXT("destinationPlanetId"));
			Ship.LocationPlanetId = JsonString(PlayerObject, TEXT("locationPlanetId"));
			Ship.ShipClassLabel = JsonString(PlayerObject, TEXT("shipClassLabel"));
			Ship.MapPosition = JsonPosition(JsonObjectField(PlayerObject, TEXT("position")));
			Ship.Fuel = JsonNumber(PlayerObject, TEXT("fuel"));
			Ship.FuelCapacity = FMath::Max(1.0f, JsonNumber(PlayerObject, TEXT("fuelCapacity"), 1.0f));
			Ship.FuelBurnPerUnit = JsonNumber(PlayerObject, TEXT("fuelBurnPerUnit"));
			Ship.Health = FMath::Clamp(JsonNumber(PlayerObject, TEXT("health"), 1.0f), 0.0f, 1.0f);
			Ship.Speed = JsonNumber(PlayerObject, TEXT("speed"));
			Ship.Credits = JsonNumber(PlayerObject, TEXT("credits"));
			Ship.CargoCapacity = static_cast<int32>(JsonNumber(PlayerObject, TEXT("cargoCapacity")));

			// Parse cargo map
			if (const TSharedPtr<FJsonObject> CargoObject = JsonObjectField(PlayerObject, TEXT("cargo")))
			{
				for (const auto& CargoPair : CargoObject->Values)
				{
					double Amount = 0.0;
					if (CargoPair.Value->TryGetNumber(Amount) && Amount > 0.0)
					{
						Ship.Cargo.Add(CargoPair.Key, static_cast<int32>(Amount));
					}
				}
			}

			double DepartedValue = 0.0;
			if (PlayerObject->TryGetNumberField(TEXT("departedAtMs"), DepartedValue) && DepartedValue > 0.0)
			{
				Ship.DepartedAtMs = DepartedValue;
				Ship.bHasDepartedAt = true;
			}

			if (const TSharedPtr<FJsonObject> Destination = JsonObjectField(PlayerObject, TEXT("destinationPosition")))
			{
				Ship.DestinationMapPosition = JsonPosition(Destination);
				Ship.bHasDestination = true;
			}
			else if (const FSpaceSystemPlanetView* DestinationPlanet = PlanetById(Ship.DestinationPlanetId))
			{
				Ship.DestinationMapPosition = DestinationPlanet->MapPosition;
				Ship.bHasDestination = true;
			}

			if (Ship.OwnerClientId == ClientId)
			{
				if (const TArray<TSharedPtr<FJsonValue>>* ExploredValues = JsonArrayField(PlayerObject, TEXT("exploredAreas")))
				{
					for (const TSharedPtr<FJsonValue>& AreaValue : *ExploredValues)
					{
						const TSharedPtr<FJsonObject> AreaObject = AreaValue->AsObject();
						FSpaceSystemExploredAreaView Area;
						Area.Center = JsonPosition(JsonObjectField(AreaObject, TEXT("center")));
						Area.Radius = JsonNumber(AreaObject, TEXT("radius"), 1.0f);
						ExploredAreas.Add(Area);
					}
				}
			}

			Ships.Add(Ship);
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* SosValues = JsonArrayField(Payload, TEXT("sosSignals")))
	{
		for (const TSharedPtr<FJsonValue>& SosValue : *SosValues)
		{
			const TSharedPtr<FJsonObject> SosObject = SosValue->AsObject();
			FSpaceSystemSosSignalView Signal;
			Signal.ClientId = JsonString(SosObject, TEXT("clientId"));
			Signal.ShipName = JsonString(SosObject, TEXT("shipName"));
			Signal.MapPosition = JsonPosition(JsonObjectField(SosObject, TEXT("position")));
			Signal.FuelNeeded = JsonNumber(SosObject, TEXT("fuelNeeded"));
			Signal.Radius = FMath::Max(0.1f, JsonNumber(SosObject, TEXT("radius"), 1.0f));
			SosSignals.Add(Signal);
		}
	}

	ConnectionStatus = FString::Printf(TEXT("connected to %s"), *ServerHttpBaseUrl);
	RequestSpawnIfNeeded(Payload);
	UpdateLiveSceneFromSnapshot();
	UpdateHUD();
}

void ASpaceSystemLevelActor::RequestSpawnIfNeeded(const TSharedPtr<FJsonObject>& Payload)
{
	if (bSpawnRequested || !Payload.IsValid() || Planets.Num() == 0)
	{
		return;
	}

	for (const FSpaceSystemShipView& Ship : Ships)
	{
		if (Ship.OwnerClientId == ClientId)
		{
			return;
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* PendingValues = JsonArrayField(Payload, TEXT("pendingActions")))
	{
		for (const TSharedPtr<FJsonValue>& PendingValue : *PendingValues)
		{
			const TSharedPtr<FJsonObject> PendingAction = JsonObjectField(PendingValue->AsObject(), TEXT("action"));
			if (JsonString(PendingAction, TEXT("clientId")) == ClientId && JsonString(PendingAction, TEXT("action")) == TEXT("spawn"))
			{
				return;
			}
		}
	}

	bSpawnRequested = true;
	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("action"), TEXT("spawn"));
	Body->SetStringField(TEXT("clientId"), ClientId);
	Body->SetStringField(TEXT("shipClassId"), TEXT("small_trade_ship"));
	Body->SetStringField(TEXT("target"), Planets[0].Id);
	Body->SetStringField(TEXT("name"), PilotName);

	FString BodyString;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyString);
	FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(ServerHttpBaseUrl / TEXT("actions"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(BodyString);
	Request->OnProcessRequestComplete().BindUObject(this, &ASpaceSystemLevelActor::HandleSpawnResponse);
	Request->ProcessRequest();
}

void ASpaceSystemLevelActor::HandleSpawnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully)
{
	if (!bConnectedSuccessfully || !Response.IsValid() || Response->GetResponseCode() >= 400)
	{
		bSpawnRequested = false;
	}
}

FVector ASpaceSystemLevelActor::ToWorldPosition(const FVector2D& MapPosition, float Height) const
{
	return FVector(MapPosition.X * MapScale, MapPosition.Y * MapScale, Height);
}

UMaterialInstanceDynamic* ASpaceSystemLevelActor::CreateColorMaterial(const FLinearColor& Color, FName Name, UMaterialInterface* MaterialTemplate)
{
	UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(MaterialTemplate ? MaterialTemplate : BaseMaterial, this, Name);
	if (Material)
	{
		Material->SetVectorParameterValue(TEXT("Color"), Color);
		Material->SetVectorParameterValue(TEXT("BaseColor"), Color);
		Material->SetScalarParameterValue(TEXT("Opacity"), Color.A);
		Material->SetScalarParameterValue(TEXT("Alpha"), Color.A);
	}
	return Material;
}

UStaticMeshComponent* ASpaceSystemLevelActor::AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bRefreshable, UMaterialInterface* MaterialTemplate)
{
	UStaticMeshComponent* Component = NewObject<UStaticMeshComponent>(this, Name);
	Component->SetupAttachment(SceneRoot);
	Component->SetStaticMesh(Mesh);
	Component->SetWorldLocation(Location);
	Component->SetWorldScale3D(Scale);
	Component->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Component->SetCastShadow(false);
	Component->SetMaterial(0, CreateColorMaterial(Color, FName(*FString::Printf(TEXT("%s_Material"), *Name.ToString())), MaterialTemplate));
	AddInstanceComponent(Component);
	Component->RegisterComponent();

	if (bRefreshable)
	{
		RefreshableComponents.Add(Component);
	}
	return Component;
}

UTextRenderComponent* ASpaceSystemLevelActor::AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color, bool bRefreshable)
{
	UTextRenderComponent* Label = NewObject<UTextRenderComponent>(this, Name);
	Label->SetupAttachment(SceneRoot);
	Label->SetWorldLocation(Location);
	Label->SetWorldRotation(FRotator(62.0f, 0.0f, 0.0f));
	Label->SetText(FText::FromString(Text));
	Label->SetTextRenderColor(Color);
	Label->SetHorizontalAlignment(EHTA_Center);
	Label->SetWorldSize(Size);
	Label->SetCastShadow(false);
	AddInstanceComponent(Label);
	Label->RegisterComponent();
	LabelComponents.Add(Label);

	if (bRefreshable)
	{
		RefreshableComponents.Add(Label);
	}
	return Label;
}

UStaticMeshComponent* ASpaceSystemLevelActor::AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color, bool bRefreshable)
{
	const FVector Delta = End - Start;
	const float Length = Delta.Size();
	if (Length <= KINDA_SMALL_NUMBER)
	{
		return nullptr;
	}

	UStaticMeshComponent* Line = AddMesh(Name, CylinderMesh, Start + Delta * 0.5f, FVector(Radius / BasicMeshRadius, Radius / BasicMeshRadius, Length / BasicMeshHeight), Color, bRefreshable);
	Line->SetWorldRotation(FRotationMatrix::MakeFromZ(Delta).Rotator());
	return Line;
}

void ASpaceSystemLevelActor::UpdateCylinderLine(UStaticMeshComponent* Line, const FVector& Start, const FVector& End, float Radius) const
{
	if (!IsValid(Line))
	{
		return;
	}

	const FVector Delta = End - Start;
	const float Length = Delta.Size();
	if (Length <= KINDA_SMALL_NUMBER)
	{
		Line->SetVisibility(false);
		return;
	}

	Line->SetVisibility(true);
	Line->SetWorldLocation(Start + Delta * 0.5f);
	Line->SetWorldScale3D(FVector(Radius / BasicMeshRadius, Radius / BasicMeshRadius, Length / BasicMeshHeight));
	Line->SetWorldRotation(FRotationMatrix::MakeFromZ(Delta).Rotator());
}

const FSpaceSystemPlanetView* ASpaceSystemLevelActor::PlanetById(const FString& PlanetId) const
{
	return Planets.FindByPredicate([&PlanetId](const FSpaceSystemPlanetView& Planet) {
		return Planet.Id == PlanetId;
	});
}

bool ASpaceSystemLevelActor::IsPositionExplored(const FVector2D& MapPosition) const
{
	for (const FSpaceSystemExploredAreaView& Area : ExploredAreas)
	{
		if (FVector2D::Distance(Area.Center, MapPosition) <= Area.Radius)
		{
			return true;
		}
	}
	return false;
}

const FSpaceSystemShipView* ASpaceSystemLevelActor::OwnShip() const
{
	for (const FSpaceSystemShipView& Ship : Ships)
	{
		if (Ship.OwnerClientId == ClientId)
		{
			return &Ship;
		}
	}
	return nullptr;
}

FVector2D ASpaceSystemLevelActor::WorldToMapPosition(const FVector& WorldPosition) const
{
	return FVector2D(WorldPosition.X / MapScale, WorldPosition.Y / MapScale);
}

void ASpaceSystemLevelActor::TickClickToMove()
{
	const APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0);
	if (!Controller || !Controller->WasInputKeyJustPressed(EKeys::RightMouseButton))
	{
		return;
	}

	if (!OwnShip())
	{
		return;
	}

	FVector WorldLocation;
	FVector WorldDirection;
	if (!Controller->DeprojectMousePositionToWorld(WorldLocation, WorldDirection))
	{
		return;
	}

	// Intersect with Z=0 plane
	if (FMath::IsNearlyZero(WorldDirection.Z))
	{
		return;
	}

	const float T = -WorldLocation.Z / WorldDirection.Z;
	if (T < 0.0f)
	{
		return;
	}

	const FVector HitPoint = WorldLocation + WorldDirection * T;
	const FVector2D MapPos = WorldToMapPosition(HitPoint);

	TSharedPtr<FJsonObject> Target = MakeShared<FJsonObject>();
	Target->SetNumberField(TEXT("x"), MapPos.X);
	Target->SetNumberField(TEXT("y"), 0.0);
	Target->SetNumberField(TEXT("z"), MapPos.Y);

	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("action"), TEXT("move"));
	Body->SetStringField(TEXT("clientId"), ClientId);
	Body->SetObjectField(TEXT("target"), Target);

	SendAction(Body);

	HintText = FString::Printf(TEXT("Moving to (%.1f, %.1f)"), MapPos.X, MapPos.Y);
	UpdateHUD();
}

void ASpaceSystemLevelActor::SendAction(const TSharedPtr<FJsonObject>& ActionBody)
{
	FString BodyString;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyString);
	FJsonSerializer::Serialize(ActionBody.ToSharedRef(), Writer);

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(ServerHttpBaseUrl / TEXT("actions"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(BodyString);
	Request->OnProcessRequestComplete().BindUObject(this, &ASpaceSystemLevelActor::HandleActionResponse);
	Request->ProcessRequest();
}

void ASpaceSystemLevelActor::HandleActionResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully)
{
	if (!bConnectedSuccessfully || !Response.IsValid())
	{
		HintText = TEXT("Action failed: no connection");
		UpdateHUD();
		return;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
	if (FJsonSerializer::Deserialize(Reader, Root) && Root.IsValid())
	{
		const FString Message = JsonString(Root, TEXT("message"));
		const FString Reason = JsonString(Root, TEXT("reason"));
		if (!Reason.IsEmpty())
		{
			HintText = FString::Printf(TEXT("Rejected: %s"), *Reason);
		}
		else if (!Message.IsEmpty())
		{
			HintText = Message;
		}
		else
		{
			HintText.Empty();
		}
	}
	else
	{
		HintText.Empty();
	}

	UpdateHUD();
}

void ASpaceSystemLevelActor::CreateHUD()
{
	if (HUDWidget.IsValid() || !GEngine || !GEngine->GameViewport)
	{
		return;
	}

	SAssignNew(HUDWidget, SSpaceSystemHUD)
		.OnTrade_Lambda([this](const FString& GoodId, bool bIsBuy, int32 Qty)
		{
			const FSpaceSystemShipView* Ship = OwnShip();
			if (!Ship || Ship->LocationPlanetId.IsEmpty())
			{
				return;
			}

			TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
			Body->SetStringField(TEXT("action"), bIsBuy ? TEXT("buy") : TEXT("sell"));
			Body->SetStringField(TEXT("clientId"), ClientId);
			Body->SetStringField(TEXT("target"), Ship->LocationPlanetId);
			Body->SetStringField(TEXT("item"), GoodId);
			Body->SetNumberField(TEXT("qty"), static_cast<double>(Qty));

			SendAction(Body);
		})
		.OnTravel_Lambda([this](const FString& PlanetId)
		{
			TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
			Body->SetStringField(TEXT("action"), TEXT("travel"));
			Body->SetStringField(TEXT("clientId"), ClientId);
			Body->SetStringField(TEXT("target"), PlanetId);

			SendAction(Body);
		})
		.OnSos_Lambda([this]()
		{
			TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
			Body->SetStringField(TEXT("action"), TEXT("sos"));
			Body->SetStringField(TEXT("clientId"), ClientId);

			SendAction(Body);
		})
		.OnShareFuel_Lambda([this](const FString& TargetClientId, int32 Qty)
		{
			TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
			Body->SetStringField(TEXT("action"), TEXT("share_fuel"));
			Body->SetStringField(TEXT("clientId"), ClientId);
			Body->SetStringField(TEXT("targetClientId"), TargetClientId);
			Body->SetNumberField(TEXT("qty"), static_cast<double>(Qty));

			SendAction(Body);
		});

	GEngine->GameViewport->AddViewportWidgetContent(
		SNew(SWeakWidget).PossiblyNullContent(HUDWidget.ToSharedRef()),
		10
	);
}

void ASpaceSystemLevelActor::UpdateHUD()
{
	if (!HUDWidget.IsValid())
	{
		return;
	}

	HUDWidget->UpdateState(OwnShip(), Planets, Ships, Stores, ExploredAreas, SosSignals, ConnectionStatus, HintText, ClientId, WorldTick);
}